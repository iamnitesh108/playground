//! One entry point, one experiment per command; every experiment prints JSON lines.
mod lifetimes;
mod order;
mod reload;
mod replay;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args[0].as_str() {
        "replay" => replay::run(&args[1..]),
        "order" => order::run(&args[1..]),
        "lazy" => lifetimes::lazy(),
        "idle" => lifetimes::idle(),
        "ttl-vs-tti" => lifetimes::ttl_vs_tti(),
        "per-entry" => lifetimes::per_entry(),
        "reload" => reload::run(),
        other => panic!("unknown command {other}"),
    }
}
