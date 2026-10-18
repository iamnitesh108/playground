/// Product ids with a Zipf (power-law) popularity, the shape of real traffic: a few products
/// get most reads.
/// Deterministic (xorshift32 with a fixed seed), so every language's benchmark reads the same
/// sequence.
pub struct Zipf {
    cdf: Vec<f64>,
    state: u32,
}

impl Zipf {
    pub fn new(products: usize, skew: f64, seed: u32) -> Self {
        let mut sum = 0.0;
        let mut cdf: Vec<f64> = (0..products).map(|i| { sum += 1.0 / ((i + 1) as f64).powf(skew); sum }).collect();
        for c in cdf.iter_mut() { *c /= sum; }
        Zipf { cdf, state: seed }
    }

    /// Next product id, 1-based.
    pub fn next(&mut self) -> i32 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 17;
        self.state ^= self.state << 5;
        let u = (self.state >> 1) as f64 / i32::MAX as f64;
        self.cdf.partition_point(|&c| c < u) as i32 + 1
    }
}
