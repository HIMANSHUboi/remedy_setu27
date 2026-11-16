CREATE TYPE public.remedy_product_category AS ENUM ('GEMSTONE', 'RUDRAKSHA', 'SPIRITUAL_PRODUCT', 'PUJA_SERVICE');
CREATE TYPE public.remedy_lead_intent AS ENUM ('PRICE_ENQUIRY', 'BULK_ORDER', 'AVAILABILITY', 'COMPLAINT', 'GENERAL_QUERY');
CREATE TYPE public.remedy_lead_status AS ENUM ('NEW', 'REPLIED', 'CONVERTED');

CREATE TABLE public.remedy_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hindi_name TEXT NOT NULL,
  category public.remedy_product_category NOT NULL,
  unit TEXT NOT NULL,
  base_price NUMERIC(12,2) NOT NULL,
  tier10_plus_price NUMERIC(12,2),
  tier50_plus_price NUMERIC(12,2),
  tier100_plus_price NUMERIC(12,2),
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT NOT NULL
);

GRANT SELECT, UPDATE ON public.remedy_products TO authenticated;
GRANT ALL ON public.remedy_products TO service_role;
ALTER TABLE public.remedy_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in agents view catalogue" ON public.remedy_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in agents update catalogue stock" ON public.remedy_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.remedy_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_message TEXT NOT NULL,
  detected_language TEXT NOT NULL,
  intent public.remedy_lead_intent NOT NULL,
  matched_product_id UUID REFERENCES public.remedy_products(id) ON DELETE SET NULL,
  extracted_quantity INTEGER NOT NULL DEFAULT 1 CHECK (extracted_quantity > 0),
  quoted_total NUMERIC(12,2),
  suggested_reply TEXT NOT NULL,
  status public.remedy_lead_status NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.remedy_leads TO authenticated;
GRANT ALL ON public.remedy_leads TO service_role;
ALTER TABLE public.remedy_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in agents view own leads" ON public.remedy_leads FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Signed-in agents create leads" ON public.remedy_leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Signed-in agents update own leads" ON public.remedy_leads FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Signed-in agents delete own leads" ON public.remedy_leads FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE INDEX remedy_leads_created_at_idx ON public.remedy_leads (created_at DESC);
CREATE INDEX remedy_leads_intent_idx ON public.remedy_leads (intent);

INSERT INTO public.remedy_products (id, name, hindi_name, category, unit, base_price, tier10_plus_price, tier50_plus_price, tier100_plus_price, in_stock, description)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'Neelam / Blue Sapphire', 'नीलम', 'GEMSTONE', 'ratti', 2800, 2500, 2200, 1950, true, 'Ceylon origin lab-certified natural blue sapphire.'),
  ('11111111-1111-4111-8111-111111111102', 'Pukhraj / Yellow Sapphire', 'पुखराज', 'GEMSTONE', 'ratti', 3200, 2900, 2600, 2300, true, 'Natural unheated Ceylon yellow sapphire with lab certificate.'),
  ('11111111-1111-4111-8111-111111111103', 'Panna / Emerald', 'पन्ना', 'GEMSTONE', 'ratti', 2400, 2150, 1900, 1650, true, 'Zambian deep-green emerald for astrological wear.'),
  ('11111111-1111-4111-8111-111111111104', 'Moonga / Red Coral', 'मूंगा', 'GEMSTONE', 'ratti', 950, 820, 720, 640, true, 'Italian capsule-cut natural red coral gemstone.'),
  ('11111111-1111-4111-8111-111111111105', 'Rudraksha / 5 Mukhi Rudraksha', 'पंचमुखी रुद्राक्ष', 'RUDRAKSHA', 'pcs', 180, 140, 110, 85, true, 'Authentic Nepal-origin panchmukhi rudraksha beads.'),
  ('11111111-1111-4111-8111-111111111106', '7 Mukhi Rudraksha', 'सप्तमुखी रुद्राक्ष', 'RUDRAKSHA', 'pcs', 650, 540, 460, 390, true, 'Certified Nepal 7 mukhi bead for Mahalakshmi kripa.'),
  ('11111111-1111-4111-8111-111111111107', 'Sphatik Mala / Crystal Rosary', 'स्फटिक माला', 'SPIRITUAL_PRODUCT', 'mala', 450, 380, 320, 270, true, 'Natural rock crystal japa mala with 108 diamond-cut beads.'),
  ('11111111-1111-4111-8111-111111111108', 'Navgraha Shanti Puja Kit', 'नवग्रह शांति पूजा किट', 'PUJA_SERVICE', 'kit', 1250, 1050, 920, 800, true, 'Complete samagri kit with energized yantra and vidhi booklet.')
ON CONFLICT (id) DO NOTHING;
