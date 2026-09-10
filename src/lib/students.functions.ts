import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeToEmail, normalizeCode } from "./diario";

async function assertTeacher(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "docente",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo la docente può fare questa operazione.");
}

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string; code: string }) => {
    const fullName = input.fullName.trim();
    const code = normalizeCode(input.code);
    if (fullName.length < 2) throw new Error("Scrivi il nome dell'alunno.");
    if (code.length < 6)
      throw new Error("Il codice deve avere almeno 6 caratteri (lettere, numeri o trattini).");
    return { fullName, code };
  })
  .handler(async ({ data, context }) => {
    await assertTeacher(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: codeToEmail(data.code),
      password: data.code,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        role: "studente",
        student_code: data.code,
        teacher_id: context.userId,
      },
    });
    if (error) {
      if (/already/i.test(error.message)) throw new Error("Questo codice è già usato da un altro alunno.");
      throw new Error(error.message);
    }
    return { ok: true, code: data.code };
  });

export const changeStudentCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string; code: string }) => {
    const code = normalizeCode(input.code);
    if (code.length < 6) throw new Error("Il codice deve avere almeno 6 caratteri.");
    return { studentId: input.studentId, code };
  })
  .handler(async ({ data, context }) => {
    await assertTeacher(context.supabase, context.userId);
    const { data: student, error: readError } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("id", data.studentId)
      .eq("teacher_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!student) throw new Error("Alunno non trovato.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.studentId, {
      email: codeToEmail(data.code),
      password: data.code,
      email_confirm: true,
      user_metadata: { student_code: data.code },
    });
    if (error) throw new Error(error.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ student_code: data.code })
      .eq("id", data.studentId);
    if (profileError) throw new Error(profileError.message);
    return { ok: true, code: data.code };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertTeacher(context.supabase, context.userId);
    const { data: student, error: readError } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("id", data.studentId)
      .eq("teacher_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!student) throw new Error("Alunno non trovato.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
