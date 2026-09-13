import { supabase } from "./supabaseClient";

/* ---- Auth ---- */
export async function signUp({ email, password }) {
  return supabase.auth.signUp({ email, password });
}
export async function signIn({ email, password }) {
  return supabase.auth.signInWithPassword({ email, password });
}
export async function signOut() {
  return supabase.auth.signOut();
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/* ---- Profile ---- */
export async function upsertProfile(userId, fields) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...fields }, { onConflict: "id" });
  if (error) throw error;
}
export async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

/* ---- Appliances (+ their service history, joined client-side) ---- */
export async function fetchAppliances(userId) {
  const { data: appliances, error: e1 } = await supabase
    .from("appliances")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (e1) throw e1;

  const { data: history, error: e2 } = await supabase
    .from("service_history")
    .select("*")
    .eq("user_id", userId);
  if (e2) throw e2;

  return appliances.map((a) => ({
    id: a.id,
    category: a.category,
    brand: a.brand,
    model: a.model,
    purchaseDate: a.purchase_date,
    warrantyMonths: a.warranty_months,
    note: a.note,
    lastServiceDate: a.last_service_date,
    serviceHistory: history
      .filter((h) => h.appliance_id === a.id)
      .map((h) => ({ date: h.date, activity: h.activity })),
  }));
}

export async function addAppliance(userId, a) {
  const { data, error } = await supabase
    .from("appliances")
    .insert({
      user_id: userId,
      category: a.category,
      brand: a.brand,
      model: a.model,
      purchase_date: a.purchaseDate,
      warranty_months: Number(a.warrantyMonths) || 12,
      note: a.note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    category: data.category,
    brand: data.brand,
    model: data.model,
    purchaseDate: data.purchase_date,
    warrantyMonths: data.warranty_months,
    note: data.note,
    lastServiceDate: null,
    serviceHistory: [],
  };
}

export async function addServiceRecord(userId, applianceId, entry) {
  const { error: e1 } = await supabase
    .from("service_history")
    .insert({ user_id: userId, appliance_id: applianceId, date: entry.date, activity: entry.activity });
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from("appliances")
    .update({ last_service_date: entry.date })
    .eq("id", applianceId)
    .eq("user_id", userId);
  if (e2) throw e2;
}

export async function deleteAppliance(userId, applianceId) {
  const { error } = await supabase.from("appliances").delete().eq("id", applianceId).eq("user_id", userId);
  if (error) throw error;
}/* ---- Service requests ---- */
export async function fetchRequests(userId) {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({ id: r.id, applianceId: r.appliance_id, issue: r.issue, status: r.status, date: r.created_at }));
}

export async function addRequest(userId, applianceId, issue) {
  const { data, error } = await supabase
    .from("service_requests")
    .insert({ user_id: userId, appliance_id: applianceId, issue })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, applianceId: data.appliance_id, issue: data.issue, status: data.status, date: data.created_at };
}
