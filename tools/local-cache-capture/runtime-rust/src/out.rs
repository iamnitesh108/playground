//! JSON lines without a JSON library: just enough for numbers, strings and lists.

pub enum J {
    N(f64),
    S(String),
    B(bool),
    L(Vec<J>),
    O(Vec<(&'static str, J)>),
}

impl J {
    pub fn render(&self) -> String {
        match self {
            J::N(n) if n.fract() == 0.0 && n.abs() < 1e15 => format!("{}", *n as i64),
            J::N(n) => format!("{}", (n * 1000.0).round() / 1000.0),
            J::S(s) => format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"")),
            J::B(b) => b.to_string(),
            J::L(xs) => format!("[{}]", xs.iter().map(J::render).collect::<Vec<_>>().join(",")),
            J::O(kv) => format!("{{{}}}", kv.iter().map(|(k, v)| format!("\"{k}\":{}", v.render())).collect::<Vec<_>>().join(",")),
        }
    }
}

pub fn n(x: impl Into<f64>) -> J {
    J::N(x.into())
}
pub fn s(x: impl Into<String>) -> J {
    J::S(x.into())
}
pub fn strs<T: ToString>(xs: impl IntoIterator<Item = T>) -> J {
    J::L(xs.into_iter().map(|x| J::S(x.to_string())).collect())
}
pub fn nums(xs: impl IntoIterator<Item = f64>) -> J {
    J::L(xs.into_iter().map(J::N).collect())
}

pub fn emit(kv: Vec<(&'static str, J)>) {
    println!("{}", J::O(kv).render());
}

pub fn median(xs: &mut [f64]) -> f64 {
    xs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let m = xs.len() / 2;
    if xs.len() % 2 == 1 { xs[m] } else { (xs[m - 1] + xs[m]) / 2.0 }
}

/// Keys with Zipf popularity: key 0 is the most popular, then 1, … (seeded, so every run is the same).
pub fn zipf_trace(length: usize, keys: usize, s: f64, seed: u64) -> Vec<u32> {
    let mut cdf = Vec::with_capacity(keys);
    let mut sum = 0.0;
    for k in 0..keys {
        sum += 1.0 / ((k + 1) as f64).powf(s);
        cdf.push(sum);
    }
    let mut x = seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1;
    (0..length)
        .map(|_| {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            let r = (x >> 11) as f64 / (1u64 << 53) as f64 * sum;
            cdf.partition_point(|&c| c < r).min(keys - 1) as u32
        })
        .collect()
}
