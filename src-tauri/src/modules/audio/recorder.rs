use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

// غلاف لتمكين إرسال  cpal::Stream  بين الخيوط بشكل آمن
pub struct SendStream(pub cpal::Stream);
unsafe impl Send for SendStream {}
unsafe impl Sync for SendStream {}

impl std::ops::Deref for SendStream {
    type Target = cpal::Stream;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

pub struct ActiveRecorder {
    recording: Arc<AtomicBool>,
    buffer: Arc<Mutex<Vec<f32>>>,
    stream: SendStream,
    sample_rate: u32,
    channels: u16,
}

pub struct RecorderState {
    pub recorder: Mutex<Option<ActiveRecorder>>,
    /// النافذة الهدف التي كانت تحت المؤشر عند بدء التسجيل — تُخزَّن لضمان الإلصاق في المكان الصحيح عند الانتهاء
    pub target_hwnd: Mutex<Option<isize>>,
    /// التسجيل بدأ والمستخدم داخل التطبيق — لا نسرق التركيز ولا نعرض HUD خارجياً
    pub paste_in_app: Mutex<bool>,
}

impl RecorderState {
    pub fn new() -> Self {
        Self {
            recorder: Mutex::new(None),
            target_hwnd: Mutex::new(None),
            paste_in_app: Mutex::new(false),
        }
    }
}


pub fn samples_to_wav(samples: &[f32], sample_rate: u32, channels: u16) -> Result<Vec<u8>, String> {
    // 1. Convert multi-channel (Stereo) to Mono by averaging samples
    let mut mono_samples = Vec::new();
    if channels > 1 {
        let channels_usize = channels as usize;
        for chunk in samples.chunks_exact(channels_usize) {
            let sum: f32 = chunk.iter().sum();
            mono_samples.push(sum / channels as f32);
        }
    } else {
        mono_samples = samples.to_vec();
    }

    // 2. Resample to 16000Hz (AI Speech-to-Text standard) using linear interpolation
    let target_sample_rate = 16000;
    let resampled_samples = if sample_rate != target_sample_rate {
        let ratio = sample_rate as f64 / target_sample_rate as f64;
        let target_len = (mono_samples.len() as f64 / ratio).round() as usize;
        let mut temp = Vec::with_capacity(target_len);
        
        for i in 0..target_len {
            let pos = i as f64 * ratio;
            let idx = pos.floor() as usize;
            let frac = pos - idx as f64;
            if idx + 1 < mono_samples.len() {
                let interpolated = mono_samples[idx] * (1.0 - frac as f32) + mono_samples[idx + 1] * frac as f32;
                temp.push(interpolated);
            } else if idx < mono_samples.len() {
                temp.push(mono_samples[idx]);
            }
        }
        temp
    } else {
        mono_samples
    };

    // 3. Write standard 16kHz Mono WAV file
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: target_sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec).map_err(|e| e.to_string())?;
        for sample in resampled_samples {
            // Convert f32 sample (-1.0 to 1.0) to i16 (-32768 to 32767)
            let sample_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
            writer.write_sample(sample_i16).map_err(|e| e.to_string())?;
        }
        writer.finalize().map_err(|e| e.to_string())?;
    }
    Ok(cursor.into_inner())
}

pub fn start_recording() -> Result<ActiveRecorder, String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "لم يتم العثور على جهاز إدخال صوتي (ميكروفون)".to_string())?;

    let config = device
        .default_input_config()
        .map_err(|e| format!("فشل الحصول على إعدادات الميكروفون: {}", e))?;

    let sample_rate = config.sample_rate().0;
    let channels = config.channels();
    let sample_format = config.sample_format();

    let buffer = Arc::new(Mutex::new(Vec::new()));
    let recording = Arc::new(AtomicBool::new(true));

    let buffer_clone = buffer.clone();
    let recording_clone = recording.clone();

    let err_handler = |err| {
        log::error!("حدث خطأ في دفق الصوت: {}", err);
    };

    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            device.build_input_stream(
                &config.into(),
                move |data: &[f32], _| {
                    if recording_clone.load(Ordering::SeqCst) {
                        if let Ok(mut buf) = buffer_clone.lock() {
                            buf.extend_from_slice(data);
                        }
                    }
                },
                err_handler,
                None,
            )
        }
        cpal::SampleFormat::I16 => {
            device.build_input_stream(
                &config.into(),
                move |data: &[i16], _| {
                    if recording_clone.load(Ordering::SeqCst) {
                        if let Ok(mut buf) = buffer_clone.lock() {
                            buf.extend(data.iter().map(|&s| s as f32 / i16::MAX as f32));
                        }
                    }
                },
                err_handler,
                None,
            )
        }
        cpal::SampleFormat::U16 => {
            device.build_input_stream(
                &config.into(),
                move |data: &[u16], _| {
                    if recording_clone.load(Ordering::SeqCst) {
                        if let Ok(mut buf) = buffer_clone.lock() {
                            buf.extend(data.iter().map(|&s| {
                                let sample_f32 = s as f32 - u16::MAX as f32 / 2.0;
                                sample_f32 / (u16::MAX as f32 / 2.0)
                            }));
                        }
                    }
                },
                err_handler,
                None,
            )
        }
        _ => return Err("صيغة عينة الصوت غير مدعومة".to_string()),
    }
    .map_err(|e| format!("فشل بناء دفق تسجيل الصوت: {}", e))?;

    stream.play().map_err(|e| format!("فشل بدء دفق تسجيل الصوت: {}", e))?;

    Ok(ActiveRecorder {
        recording,
        buffer,
        stream: SendStream(stream),
        sample_rate,
        channels,
    })
}

impl ActiveRecorder {
    pub fn stop(self) -> Result<Vec<u8>, String> {
        self.recording.store(false, Ordering::SeqCst);
        let _ = self.stream.pause();
        std::thread::sleep(std::time::Duration::from_millis(200));

        let samples = self.buffer.lock().map_err(|e| e.to_string())?.clone();
        if samples.is_empty() {
            return Err(
                "لم يُلتقط أي صوت من الميكروفون. تحقق من صلاحيات الميكروفون في ويندوز.".to_string(),
            );
        }

        let min_samples =
            ((self.sample_rate as f64 * 0.25).round() as usize).max(1) * self.channels as usize;
        if samples.len() < min_samples {
            return Err("التسجيل قصير جداً. تحدث لفترة أطول ثم أوقف التسجيل.".to_string());
        }

        samples_to_wav(&samples, self.sample_rate, self.channels)
    }
}
