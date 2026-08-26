//! Minimal ANSI helpers — no external crate. Respects TTY, NO_COLOR, FORCE_COLOR.

use std::io::IsTerminal;
use std::sync::OnceLock;

fn color_enabled() -> bool {
    static ENABLED: OnceLock<bool> = OnceLock::new();
    *ENABLED.get_or_init(|| {
        match std::env::var("FORCE_COLOR") {
            Ok(force) if force == "0" => false,
            Ok(force) if !force.is_empty() => true,
            _ => std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none(),
        }
    })
}

fn wrap(open: &str, close: &str, s: &str) -> String {
    if color_enabled() {
        format!("{open}{s}{close}")
    } else {
        s.to_string()
    }
}

pub fn bold(s: &str) -> String {
    wrap("\x1b[1m", "\x1b[22m", s)
}

pub fn dim(s: &str) -> String {
    wrap("\x1b[2m", "\x1b[22m", s)
}

pub fn cyan(s: &str) -> String {
    wrap("\x1b[36m", "\x1b[39m", s)
}

pub fn green(s: &str) -> String {
    wrap("\x1b[32m", "\x1b[39m", s)
}

pub fn yellow(s: &str) -> String {
    wrap("\x1b[33m", "\x1b[39m", s)
}

pub fn red(s: &str) -> String {
    wrap("\x1b[31m", "\x1b[39m", s)
}

pub fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for d in chars.by_ref() {
                    if d.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}

pub fn visible_width(s: &str) -> usize {
    strip_ansi(s).chars().count()
}

fn pad_end_visible(s: &str, width: usize) -> String {
    let pad = width.saturating_sub(visible_width(s));
    format!("{s}{}", " ".repeat(pad))
}

/// Draw a unicode box around `body_lines` (TS `box`).
pub fn box_frame(title: &str, body_lines: &[String], inner_width: usize) -> String {
    let title_vis = visible_width(title);
    let top = format!(
        "┌─ {title} {}┐",
        "─".repeat((inner_width.saturating_sub(title_vis).saturating_sub(3)).max(1))
    );
    let bottom = format!("└{}┘", "─".repeat(inner_width));
    let rows: Vec<String> = body_lines
        .iter()
        .map(|line| {
            let padded = pad_end_visible(line, inner_width.saturating_sub(2));
            format!("│ {padded} │")
        })
        .collect();
    let mut parts = Vec::with_capacity(rows.len() + 2);
    parts.push(top);
    parts.extend(rows);
    parts.push(bottom);
    parts.join("\n")
}
