// Lightweight, dependency-free normalizer for "draft schedule" data coming via prop.
// - Coerces types
// - Adds safe defaults
// - Deduplicates by id (last one wins)
// - Tolerant to slightly different shapes
export function normalizeDrafts(input) {
  const errors = [];
  const byId = {};
  const arr = Array.isArray(input) ? input : input ? [input] : [];

  for (let i = 0; i < arr.length; i++) {
    const raw = arr[i];
    if (!raw || typeof raw !== "object") {
      errors.push({ index: i, reason: "not-an-object" });
      continue;
    }

    // Build a stable id if missing
    const fallbackId = `${raw.class_id ?? "class?"}:${raw.day_id ?? "day?"}:${
      raw.period_id ?? raw.start_time ?? "period?"
    }`;
    const id = String(raw.id ?? fallbackId);

    const day_id = Number(raw.day_id ?? 0);
    const period_id =
      raw.period_id != null ? String(raw.period_id) : String(raw.start_time ?? raw.time_block_id ?? "");
    const isDraft = raw.isDraft === false ? false : true;

    const staff_ids = Array.isArray(raw.staff_ids)
      ? raw.staff_ids.filter((x) => typeof x === "string" && x)
      : [];
    const teacher_names = Array.isArray(raw.teacher_names)
      ? raw.teacher_names.filter((x) => typeof x === "string")
      : [];

    const normalized = {
      // Keep original fields
      ...raw,
      // Normalized/required-ish fields
      id,
      isDraft,
      day_id,
      period_id,
      room_id: raw.room_id != null ? String(raw.room_id) : "",
      class_id: raw.class_id != null ? String(raw.class_id) : "",
      subject_id: raw.subject_id != null ? String(raw.subject_id) : "",
      staff_ids,
      teacher_names,
      // Safe defaults for optional strings
      room_name: typeof raw.room_name === "string" ? raw.room_name : "",
      class_name: typeof raw.class_name === "string" ? raw.class_name : "",
      course_name: typeof raw.course_name === "string" ? raw.course_name : "",
      subject_name: typeof raw.subject_name === "string" ? raw.subject_name : "",
      day_name_de: typeof raw.day_name_de === "string" ? raw.day_name_de : "",
      day_name_en: typeof raw.day_name_en === "string" ? raw.day_name_en : "",
      display_cell: typeof raw.display_cell === "string" ? raw.display_cell : "",
      scheduled_room_name: typeof raw.scheduled_room_name === "string" ? raw.scheduled_room_name : "",
      // Optional nullable fields pass through unchanged
      subject_color: raw.subject_color ?? null,
      subject_icon_id: raw.subject_icon_id ?? null,
      class_grade_level:
        typeof raw.class_grade_level === "number" ? raw.class_grade_level : raw.class_grade_level ?? null,
      currentlyScheduled: raw.currentlyScheduled === true
    };

    if (!id) {
      errors.push({ index: i, reason: "missing-id" });
      continue;
    }

    // Deduplicate by id (last one wins)
    byId[id] = normalized;
  }

  const list = Object.values(byId);
  return { list, byId, errors };
}
