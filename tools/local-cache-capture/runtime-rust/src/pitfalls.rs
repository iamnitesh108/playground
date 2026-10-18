//! A mutable cached value: moka hands out clones, so sharing has to be asked for (Arc<Mutex<…>>).
use crate::out::*;
use moka::sync::Cache;
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug)]
pub struct Cart {
    items: Vec<String>,
    total_cents: u32,
}

pub fn run() {
    // a builder without max_capacity builds an unbounded cache
    let unbounded: Cache<u64, u64> = Cache::builder().build();
    let bounded: Cache<u64, u64> = Cache::new(1_000);
    emit(vec![("exp", s("unbounded")), ("lib", s("moka")), ("result", s(format!("builder().build(): max_capacity() = {:?}; Cache::new(1_000): {:?}",
        unbounded.policy().max_capacity(), bounded.policy().max_capacity())))]);

    // #region mutation
    // get() returns a clone: changing it changes nothing in the cache
    let carts: Cache<String, Cart> = Cache::new(100);
    carts.insert("cart:7".into(), Cart { items: vec!["book".into()], total_cents: 1200 });
    let mut mine = carts.get("cart:7").unwrap();
    mine.total_cents = 0;
    mine.items.push("free gift".into());
    let other = carts.get("cart:7").unwrap();
    // #endregion
    emit(vec![("exp", s("mutation")), ("lib", s("moka")), ("mode", s("Cache<String, Cart>")), ("sameObject", J::B(false)),
        ("otherSees", s(format!("{:?} total {}", other.items, other.total_cents))), ("originalTotal", n(1200))]);

    // #region shared
    // with Arc<Mutex<Cart>> every reader shares one Cart, and a change leaks to all of them
    let shared: Cache<String, Arc<Mutex<Cart>>> = Cache::new(100);
    shared.insert("cart:7".into(), Arc::new(Mutex::new(Cart { items: vec!["book".into()], total_cents: 1200 })));
    let mine = shared.get("cart:7").unwrap();
    {
        let mut cart = mine.lock().unwrap();
        cart.total_cents = 0;
        cart.items.push("free gift".into());
    }
    let other = shared.get("cart:7").unwrap();
    // #endregion
    let seen = other.lock().unwrap().clone();
    emit(vec![("exp", s("mutation")), ("lib", s("moka")), ("mode", s("Cache<String, Arc<Mutex<Cart>>>")), ("sameObject", J::B(Arc::ptr_eq(&mine, &other))),
        ("otherSees", s(format!("{:?} total {}", seen.items, seen.total_cents))), ("originalTotal", n(1200))]);
}
