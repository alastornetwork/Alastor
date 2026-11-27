use serde_json::Value;

fn escape_jcs_string(input: &str, out: &mut String) {
    out.push('"');
    for ch in input.chars() {
        let code = ch as u32;
        match code {
            0x08 => out.push_str("\\b"),
            0x09 => out.push_str("\\t"),
            0x0A => out.push_str("\\n"),
            0x0C => out.push_str("\\f"),
            0x0D => out.push_str("\\r"),
            0x22 => out.push_str("\\\""),
            0x5C => out.push_str("\\\\"),
            0x00..=0x1F => {
                out.push_str(&format!("\\u{:04x}", code));
            }
            _ => out.push(ch),
        }
    }
    out.push('"');
}

fn cmp_utf16_code_units(a: &str, b: &str) -> std::cmp::Ordering {
    let mut it_a = a.encode_utf16();
    let mut it_b = b.encode_utf16();
    loop {
        match (it_a.next(), it_b.next()) {
            (Some(ua), Some(ub)) => match ua.cmp(&ub) {
                std::cmp::Ordering::Equal => continue,
                non_eq => return non_eq,
            },
            (None, Some(_)) => return std::cmp::Ordering::Less,
            (Some(_), None) => return std::cmp::Ordering::Greater,
            (None, None) => return std::cmp::Ordering::Equal,
        }
    }
}

/// Serializes any JSON `Value` according to RFC 8785 (JSON Canonicalization Scheme).
pub fn serialize_jcs(value: &Value) -> Result<String, String> {
    let mut buf = String::with_capacity(512);
    write_jcs(value, &mut buf)?;
    Ok(buf)
}

fn write_jcs(value: &Value, out: &mut String) -> Result<(), String> {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Number(num) => {
            if let Some(i) = num.as_i64() {
                out.push_str(&i.to_string());
            } else if let Some(u) = num.as_u64() {
                out.push_str(&u.to_string());
            } else if let Some(f) = num.as_f64() {
                if !f.is_finite() {
                    return Err("RFC 8785 forbids non-finite numbers".to_string());
                }
                if f == 0.0 {
                    out.push('0');
                } else {
                    out.push_str(&f.to_string());
                }
            } else {
                return Err("Unsupported JSON number representation".to_string());
            }
        }
        Value::String(s) => escape_jcs_string(s, out),
        Value::Array(items) => {
            out.push('[');
            for (idx, item) in items.iter().enumerate() {
                if idx > 0 {
                    out.push(',');
                }
                write_jcs(item, out)?;
            }
            out.push(']');
        }
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort_by(|a, b| cmp_utf16_code_units(a.as_str(), b.as_str()));
            out.push('{');
            for (idx, key) in keys.iter().enumerate() {
                if idx > 0 {
                    out.push(',');
                }
                escape_jcs_string(key, out);
                out.push(':');
                if let Some(val) = map.get(*key) {
                    write_jcs(val, out)?;
                }
            }
            out.push('}');
        }
    }
    Ok(())
}
