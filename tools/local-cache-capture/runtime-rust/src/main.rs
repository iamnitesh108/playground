mod alloc;
mod bench;
mod memory;
mod out;
mod pitfalls;
mod single_flight;
mod stats;
mod throughput;

#[global_allocator]
static GLOBAL: alloc::Counting = alloc::Counting;

fn main() {
    let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    out::emit(vec![("exp", out::s("runtime")), ("moka", out::s("0.12")), ("cores", out::n(cores as u32))]);
    match std::env::args().nth(1).as_deref() {
        Some("singleflight") => single_flight::run(),
        Some("footprint") => memory::footprint(),
        Some("weight") => memory::weight(),
        Some("throughput") => throughput::run(),
        Some("bench") => bench::run(),
        Some("stats") => stats::run(),
        Some("pitfalls") => pitfalls::run(),
        other => panic!("unknown experiment {other:?}"),
    }
    std::process::exit(0);
}
