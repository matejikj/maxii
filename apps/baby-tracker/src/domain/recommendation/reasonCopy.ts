import type { RecommendationReasonCode } from './types';

/**
 * Caregiver-facing Czech copy for reason codes. Intentionally free of child
 * identifiers, free-text notes, and deficit language.
 */
export const RECOMMENDATION_REASON_COPY_CS: Record<RecommendationReasonCode, string> = {
  eligible: 'Aktivita splňuje dnešní podmínky.',
  age_match: 'Hodí se k aktuálnímu věku.',
  interest_area: 'Souvisí s oblastí, kterou sledujete.',
  favorite_boost: 'Máte ji mezi oblíbenými.',
  diversity_area: 'Tentokrát nabízíme jinou oblast objevování.',
  repeat_ok: 'Je v pořádku ji zkusit znovu.',
  missing_birth_date: 'Doplňte datum narození pro vhodné aktivity.',
  age_out_of_content_window: 'Pro tento věk zatím nemáme připravená doporučení.',
  age_out_of_activity: 'Tato aktivita neodpovídá aktuálnímu věku.',
  environment_mismatch: 'Neshoduje se s vybraným místem.',
  materials_required: 'Potřebuje pomůcky, které teď nechcete používat.',
  materials_missing: 'Chybí potřebné pomůcky.',
  duration_mismatch: 'Neshoduje se s vybranou délkou.',
  revision_not_recommendable: 'Obsah není v doporučovacím katalogu.',
  user_excluded: 'Tuto aktivitu jste skryli.',
  unknown_required_condition: 'Nelze ověřit požadovanou podmínku.',
  empty_catalog: 'Lokální katalog je prázdný.',
  profile_changed: 'Podmínky se změnily, proto nabídku obnovíme.',
  revision_withdrawn: 'Tato verze aktivity už není v katalogu.',
  sleep_later: 'Na později — právě běží spánek.',
  care_only_today: 'Dnes jen péče; nabídka zůstává v Rozvoji.',
  single_eligible: 'Dnes je vhodná jedna možnost.',
  no_eligible_candidates: 'Teď nemáme vhodnou činnost pro zvolené podmínky.',
};

export function reasonCopyCs(code: RecommendationReasonCode): string {
  return RECOMMENDATION_REASON_COPY_CS[code];
}
