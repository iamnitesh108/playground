//! A global allocator that counts the bytes currently allocated, so a structure's memory can be measured exactly.
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

pub struct Counting;
static LIVE: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, l: Layout) -> *mut u8 {
        LIVE.fetch_add(l.size(), Ordering::Relaxed);
        System.alloc(l)
    }
    unsafe fn dealloc(&self, p: *mut u8, l: Layout) {
        LIVE.fetch_sub(l.size(), Ordering::Relaxed);
        System.dealloc(p, l)
    }
    unsafe fn realloc(&self, p: *mut u8, l: Layout, new: usize) -> *mut u8 {
        LIVE.fetch_add(new, Ordering::Relaxed);
        LIVE.fetch_sub(l.size(), Ordering::Relaxed);
        System.realloc(p, l, new)
    }
}

pub fn live() -> usize {
    LIVE.load(Ordering::Relaxed)
}
