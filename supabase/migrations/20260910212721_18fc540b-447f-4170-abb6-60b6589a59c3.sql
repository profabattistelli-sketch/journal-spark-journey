-- Ruoli
CREATE TYPE public.app_role AS ENUM ('docente', 'studente');
CREATE TYPE public.entry_kind AS ENUM ('arrabbiatura', 'successo', 'lavoro', 'gentilezza', 'strategia', 'libera');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'docente',
  student_code TEXT UNIQUE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  split_ratio INT NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_my_student(_student_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _student_id AND teacher_id = auth.uid());
$$;

CREATE POLICY "profili: leggo il mio" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profili: la docente legge i suoi alunni" ON public.profiles FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "profili: aggiorno il mio" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profili: la docente aggiorna i suoi alunni" ON public.profiles FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "profili: la docente elimina i suoi alunni" ON public.profiles FOR DELETE TO authenticated USING (teacher_id = auth.uid());

CREATE POLICY "ruoli: leggo i miei" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Creazione automatica del profilo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'docente');
BEGIN
  INSERT INTO public.profiles (id, full_name, role, student_code, teacher_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    _role,
    NEW.raw_user_meta_data ->> 'student_code',
    NULLIF(NEW.raw_user_meta_data ->> 'teacher_id', '')::uuid
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Annotazioni
CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.entry_kind NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  intensity INT,
  trigger_text TEXT,
  strategy_text TEXT,
  points INT NOT NULL DEFAULT 0,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note: alunno legge le sue" ON public.entries FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "note: alunno scrive le sue" ON public.entries FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid() AND author_id = auth.uid());
CREATE POLICY "note: alunno modifica le sue" ON public.entries FOR UPDATE TO authenticated USING (student_id = auth.uid() AND author_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "note: alunno cancella le sue" ON public.entries FOR DELETE TO authenticated USING (student_id = auth.uid() AND author_id = auth.uid());
CREATE POLICY "note: docente gestisce i suoi alunni" ON public.entries FOR ALL TO authenticated USING (public.is_my_student(student_id)) WITH CHECK (public.is_my_student(student_id));

-- I punti li assegna solo la docente
CREATE OR REPLACE FUNCTION public.guard_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'docente') THEN
    NEW.points := COALESCE(OLD.points, 0);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER entries_guard_points
BEFORE INSERT OR UPDATE ON public.entries
FOR EACH ROW EXECUTE FUNCTION public.guard_points();

-- Premi
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cost INT NOT NULL DEFAULT 10,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "premi: alunno legge i suoi" ON public.rewards FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "premi: docente gestisce i suoi alunni" ON public.rewards FOR ALL TO authenticated USING (public.is_my_student(student_id)) WITH CHECK (public.is_my_student(student_id));

-- Scarabocchi
CREATE TABLE public.doodles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doodles TO authenticated;
GRANT ALL ON public.doodles TO service_role;
ALTER TABLE public.doodles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scarabocchi: alunno gestisce i suoi" ON public.doodles FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "scarabocchi: docente vede i suoi alunni" ON public.doodles FOR ALL TO authenticated USING (public.is_my_student(student_id)) WITH CHECK (public.is_my_student(student_id));