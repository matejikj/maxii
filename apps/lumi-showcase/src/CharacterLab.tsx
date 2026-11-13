import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  CHARACTER_APPEARANCE_STYLES,
  CHARACTER_BLUEPRINTS,
  CHARACTER_COLLECTION,
  CHARACTER_SEMANTIC_STATES,
  LUMI_ANIMALS,
  LumiBlueprintCharacter,
  LumiCharacter,
  RABBIT_ANATOMY_BASELINE,
  SELECTED_RABBIT_ART_VARIANT,
  buildRabbitArtVariants,
  listStudioActionsForSpecies,
  resolveSemanticPresentation,
  type CharacterAppearanceStyle,
  type LumiAnimal,
  type CharacterPose,
  type CharacterExpression,
  type CharacterAccessory,
  type CharacterProportions,
  type CharacterSemanticState,
} from '@lumi/forest-design';

const EXPRESSIONS: readonly CharacterExpression[] = ['neutral', 'happy', 'curious', 'sleepy'];
const POSES: readonly CharacterPose[] = ['sitting', 'standing'];
const ACCESSORIES: readonly CharacterAccessory[] = ['bow', 'flower', 'scarf', 'star'];
const STYLE_LABELS: Record<CharacterAppearanceStyle, string> = {
  forest: 'Les',
  workshop: 'Dílna',
  restrained: 'Střídmý',
};

export function CharacterLab() {
  const { width } = useWindowDimensions();
  const [species, setSpecies] = useState<LumiAnimal>('rabbit');
  const [appearanceStyle, setAppearanceStyle] = useState<CharacterAppearanceStyle>('forest');
  const [accessory, setAccessory] = useState<CharacterAccessory | 'none'>('none');
  const [bigHead, setBigHead] = useState(false);
  const [longEars, setLongEars] = useState(false);
  const proportions = useMemo<CharacterProportions | undefined>(
    () =>
      bigHead || (longEars && species !== 'hedgehog')
        ? {
            ...(bigHead ? { head: 1.12 } : {}),
            ...(longEars && species !== 'hedgehog' ? { ears: 1.2 } : {}),
          }
        : undefined,
    [bigHead, longEars, species],
  );
  const selectedAccessories = useMemo<readonly CharacterAccessory[]>(
    () => (accessory === 'none' ? [] : [accessory]),
    [accessory],
  );
  const rabbitVariants = useMemo(() => buildRabbitArtVariants(RABBIT_ANATOMY_BASELINE), []);
  const wide = width >= 720;
  const columns = wide ? 4 : 2;
  const cardWidth = Math.max(130, (Math.min(width, 940) - 44 - 12 * (columns - 1)) / columns);

  return (
    <ScrollView testID="character-lab" style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>CHARACTER ENGINE · v0.3</Text>
      <Text style={styles.heading}>Seznam se s lesními kamarády</Text>
      <Text style={styles.subtitle}>
        Osm postav, 4 emoce, dvě pózy a osm společných sémantických stavů. Vše živě z vektorových
        anatomických dílů.
      </Text>
      <Text style={styles.smallHeading}>PILOT LUMI · TŘI SMĚRY</Text>
      <Text style={styles.subtitle}>
        Stejná póza a měřítko. Vybraný pracovní směr je {SELECTED_RABBIT_ART_VARIANT}.
      </Text>
      <View style={styles.gallery}>
        {rabbitVariants.map((variant) => (
          <View
            key={variant.id}
            testID={`rabbit-art-variant-${variant.id}`}
            style={[
              styles.tile,
              { width: cardWidth },
              variant.id === SELECTED_RABBIT_ART_VARIANT && styles.pilotSelected,
            ]}
          >
            <LumiBlueprintCharacter
              blueprint={{
                ...CHARACTER_BLUEPRINTS.rabbit,
                base: { kind: 'parts', parts: variant.parts },
              }}
              width={cardWidth - 18}
              height={140}
              testID={`rabbit-art-preview-${variant.id}`}
            />
            <Text style={styles.variantLabel}>
              {variant.id} · {variant.label}
            </Text>
            <Text style={styles.poseLabel}>{variant.summary}</Text>
          </View>
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {LUMI_ANIMALS.map((animal) => (
          <Pressable
            key={animal}
            testID={`character-species-${animal}`}
            onPress={() => setSpecies(animal)}
            style={[styles.chip, species === animal && styles.chipActive]}
          >
            <Text style={[styles.chipText, species === animal && styles.chipTextActive]}>
              {CHARACTER_BLUEPRINTS[animal].displayName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.smallHeading}>VZHLED · LES / DÍLNA / STŘÍDMÝ</Text>
      <Text style={styles.subtitle}>
        Neutrální náhled bez produktových dat. Dílna je volba vzhledu, ne věkové zamknutí.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CHARACTER_APPEARANCE_STYLES.map((style) => (
          <Pressable
            key={style}
            testID={`character-style-${style}`}
            onPress={() => setAppearanceStyle(style)}
            style={[styles.chip, appearanceStyle === style && styles.chipActive]}
          >
            <Text style={[styles.chipText, appearanceStyle === style && styles.chipTextActive]}>
              {STYLE_LABELS[style]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.gallery}>
        {CHARACTER_APPEARANCE_STYLES.map((style) => (
          <View
            key={style}
            testID={`character-style-preview-${species}-${style}`}
            style={[
              styles.tile,
              { width: cardWidth },
              appearanceStyle === style && styles.pilotSelected,
            ]}
          >
            <LumiCharacter
              species={species}
              pose="sitting"
              expression="happy"
              appearanceStyle={style}
              width={cardWidth - 18}
              height={140}
            />
            <Text style={styles.variantLabel}>{STYLE_LABELS[style]}</Text>
            <Text style={styles.poseLabel}>{style}</Text>
          </View>
        ))}
      </View>
      {listStudioActionsForSpecies(species).length > 0 ? (
        <>
          <Text style={styles.smallHeading}>DÍLNA · STATICKÉ AKCE</Text>
          <View style={styles.gallery}>
            {listStudioActionsForSpecies(species).map((action) => (
              <View
                key={action.id}
                testID={`character-studio-${species}-${action.id}`}
                style={[styles.tile, { width: cardWidth }]}
              >
                <LumiCharacter
                  species={species}
                  pose={action.pose}
                  expression={action.expression}
                  appearanceStyle="workshop"
                  props={action.props}
                  prop={action.props[0] ?? null}
                  width={cardWidth - 18}
                  height={140}
                />
                <Text style={styles.variantLabel}>{action.labelCs}</Text>
                <Text style={styles.poseLabel}>{action.props.join(' + ')}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
      <Text style={styles.smallHeading}>DOPLNĚK</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {(['none', ...ACCESSORIES] as const).map((item) => (
          <Pressable
            key={item}
            testID={`character-accessory-${item}`}
            onPress={() => setAccessory(item)}
            style={[styles.chip, accessory === item && styles.chipActive]}
          >
            <Text style={[styles.chipText, accessory === item && styles.chipTextActive]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.smallHeading}>PROPORCE</Text>
      <View style={styles.chips}>
        <Pressable
          testID="character-large-head"
          onPress={() => setBigHead((v) => !v)}
          style={[styles.chip, bigHead && styles.chipActive]}
        >
          <Text style={[styles.chipText, bigHead && styles.chipTextActive]}>Velká hlavička</Text>
        </Pressable>
        {species !== 'hedgehog' && (
          <Pressable
            testID="character-long-ears"
            onPress={() => setLongEars((v) => !v)}
            style={[styles.chip, longEars && styles.chipActive]}
          >
            <Text style={[styles.chipText, longEars && styles.chipTextActive]}>Delší ouška</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.gallery}>
        {POSES.flatMap((pose) =>
          EXPRESSIONS.map((expression) => (
            <View
              key={`${pose}-${expression}`}
              testID={`character-variant-${species}-${pose}-${expression}`}
              style={[styles.tile, { width: cardWidth }]}
            >
              <LumiCharacter
                species={species}
                pose={pose}
                expression={expression}
                appearanceStyle={appearanceStyle}
                accessories={selectedAccessories}
                {...(proportions === undefined ? {} : { proportions })}
                width={cardWidth - 18}
                height={140}
              />
              <Text style={styles.variantLabel}>{expression}</Text>
              <Text style={styles.poseLabel}>{pose}</Text>
            </View>
          )),
        )}
      </View>
      <Text style={styles.smallHeading}>SÉMANTICKÉ STAVY · STATICKÝ FALLBACK</Text>
      <Text style={styles.subtitle}>
        {CHARACTER_COLLECTION[species].displayName}:{' '}
        {CHARACTER_COLLECTION[species].signatureActions.map((action) => action.labelCs).join(' · ')}
      </Text>
      <View style={styles.gallery}>
        {CHARACTER_SEMANTIC_STATES.map((state: CharacterSemanticState) => {
          const resolved = resolveSemanticPresentation(state, false);
          return (
            <View
              key={state}
              testID={`character-semantic-${species}-${state}`}
              style={[styles.tile, { width: cardWidth }]}
            >
              <LumiCharacter
                species={species}
                pose={resolved.pose}
                expression={resolved.expression}
                width={cardWidth - 18}
                height={140}
              />
              <Text style={styles.variantLabel}>{state}</Text>
              <Text style={styles.poseLabel}>
                {resolved.pose}/{resolved.expression}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.smallHeading}>SIGNATURE AKCE · REKVIZITY</Text>
      <View style={styles.gallery}>
        {CHARACTER_COLLECTION[species].signatureActions.map((action) => {
          const resolved = resolveSemanticPresentation(action.semantic, false);
          return (
            <View
              key={action.id}
              testID={`character-action-${species}-${action.id}`}
              style={[styles.tile, { width: cardWidth }]}
            >
              <LumiCharacter
                species={species}
                pose={resolved.pose}
                expression={resolved.expression}
                {...(action.prop ? { prop: action.prop } : {})}
                width={cardWidth - 18}
                height={140}
              />
              <Text style={styles.variantLabel}>{action.labelCs}</Text>
              <Text style={styles.poseLabel}>{action.prop ?? 'bez rekvizity'}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.footnote}>
        Geometrie všech variant se generuje lokálně. Osm druhů je součástí instalace; neznámé ID
        padá na klidného králíka.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 50, alignItems: 'stretch' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: '#91AF8F' },
  heading: { fontSize: 25, fontWeight: '800', color: '#384C4A', marginTop: 7 },
  subtitle: { color: '#647672', fontSize: 13, lineHeight: 20, marginTop: 5, marginBottom: 13 },
  chips: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingVertical: 6 },
  chip: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E9E1',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipActive: { backgroundColor: '#384C4A', borderColor: '#384C4A' },
  chipText: { color: '#536660', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: '#FFFFFF' },
  smallHeading: {
    marginTop: 9,
    color: '#758B7F',
    letterSpacing: 1.5,
    fontSize: 10,
    fontWeight: '800',
  },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 16,
  },
  tile: {
    minWidth: 130,
    padding: 9,
    backgroundColor: 'rgba(255,255,255,.86)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    alignItems: 'center',
  },
  variantLabel: {
    color: '#384C4A',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize',
    marginTop: 3,
  },
  poseLabel: { color: '#84968D', fontSize: 10, textTransform: 'capitalize', marginTop: 2 },
  footnote: { fontSize: 11, color: '#84968D', lineHeight: 17, marginTop: 16 },
  pilotSelected: { borderWidth: 2, borderColor: '#91AF8F' },
});
