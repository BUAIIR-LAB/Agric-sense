import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';
import {
  DELIVERY_PERIOD_LABELS,
  listPriceFromDiscount,
  type DeliveryMode,
  type DeliveryPeriod,
} from '@/types/marketplace';

export type ProduceKind = 'crop' | 'livestock';
export type SaleChannel = 'retail' | 'wholesale' | 'both';
export type QualityGrade = 'premium' | 'grade_a' | 'grade_b' | 'standard';
export type VatMode = 'inclusive' | 'exclusive' | 'zero' | 'exempt';

export type ProduceListingDraft = {
  photos: string[];
  title: string;
  produceKind: ProduceKind;
  productName: string;
  quality: QualityGrade;
  stockQty: string;
  stockUnit: string;
  saleChannel: SaleChannel;
  brand: string;
  price: string;
  discountPercent: string;
  applyDiscount: boolean;
  vatMode: VatMode;
  location: string;
  minOrderQty: string;
  harvestDate: string;
  organic: boolean;
  deliveryMode: DeliveryMode;
  deliveryPeriod: DeliveryPeriod;
  contactPhone: string;
  description: string;
};

export type SubmittedProduceListing = ProduceListingDraft & {
  id: string;
  createdAt: string;
};

const MAX_PHOTOS = 3;
const MIN_PHOTOS = 1;

export const UGANDA_CROPS = [
  'Maize',
  'Cassava',
  'Beans',
  'Groundnuts',
  'Matooke (Banana)',
  'Sweet potatoes',
  'Irish potatoes',
  'Rice',
  'Millet',
  'Sorghum',
  'Coffee',
  'Tea',
  'Cotton',
  'Sugarcane',
  'Sesame (Simsim)',
  'Soybeans',
  'Cowpeas',
  'Pigeon peas',
  'Sunflower',
  'Tomatoes',
  'Onions',
  'Cabbage',
  'Green peppers',
  'Eggplant (Ntula)',
  'Watermelon',
  'Pineapple',
  'Mangoes',
  'Avocado',
  'Passion fruit',
  'Vanilla',
  'Cocoa',
  'Pumpkin',
  'Okra',
  'Carrots',
  'Cucumber',
  'Wheat',
  'Chickpeas',
  'Green grams',
  'Tobacco',
] as const;

export const UGANDA_LIVESTOCK = [
  'Cattle',
  'Goats',
  'Sheep',
  'Pigs',
  'Chickens (layers)',
  'Chickens (broilers)',
  'Turkeys',
  'Ducks',
  'Rabbits',
  'Guinea fowl',
  'Bees / Honey',
  'Fish (tilapia)',
  'Fish (catfish)',
  'Donkeys',
] as const;

const QUALITY_OPTIONS: { value: QualityGrade; label: string }[] = [
  { value: 'premium', label: 'Premium' },
  { value: 'grade_a', label: 'Grade A' },
  { value: 'grade_b', label: 'Grade B' },
  { value: 'standard', label: 'Standard' },
];

const SALE_OPTIONS: { value: SaleChannel; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'both', label: 'Both' },
];

const VAT_OPTIONS: { value: VatMode; label: string }[] = [
  { value: 'inclusive', label: 'VAT inclusive' },
  { value: 'exclusive', label: 'VAT exclusive (+18%)' },
  { value: 'zero', label: 'Zero-rated' },
  { value: 'exempt', label: 'VAT exempt' },
];

const CROP_UNITS = ['kg', 'bag (100kg)', 'bag (50kg)', 'crate', 'bunch', 'piece', 'tonne'];
const LIVESTOCK_UNITS = ['head', 'piece', 'crate', 'kg', 'litre'];

type Props = {
  initialPhone?: string;
  initialLocation?: string;
  onCancel: () => void;
  onSubmit: (listing: SubmittedProduceListing) => void;
};

function emptyDraft(phone: string, location: string): ProduceListingDraft {
  return {
    photos: [],
    title: '',
    produceKind: 'crop',
    productName: '',
    quality: 'grade_a',
    stockQty: '',
    stockUnit: 'kg',
    saleChannel: 'retail',
    brand: '',
    price: '',
    discountPercent: '',
    applyDiscount: false,
    vatMode: 'inclusive',
    location,
    minOrderQty: '',
    harvestDate: '',
    organic: false,
    deliveryMode: 'paid',
    deliveryPeriod: '3_days',
    contactPhone: phone,
    description: '',
  };
}

export function PostListingForm({
  initialPhone = '',
  initialLocation = '',
  onCancel,
  onSubmit,
}: Props) {
  const [draft, setDraft] = useState<ProduceListingDraft>(() =>
    emptyDraft(initialPhone, initialLocation),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const productOptions = draft.produceKind === 'crop' ? UGANDA_CROPS : UGANDA_LIVESTOCK;
  const unitOptions = draft.produceKind === 'crop' ? CROP_UNITS : LIVESTOCK_UNITS;

  const listPreview = useMemo(() => {
    const price = Number.parseFloat(draft.price.replace(/,/g, ''));
    const discount = Number.parseFloat(draft.discountPercent);
    if (!Number.isFinite(price) || price <= 0) return null;
    if (!draft.applyDiscount || !Number.isFinite(discount) || discount <= 0) {
      return { selling: price, list: null as number | null, pct: 0 };
    }
    const pct = Math.min(99, Math.round(discount));
    return { selling: price, list: listPriceFromDiscount(price, pct), pct };
  }, [draft.price, draft.discountPercent, draft.applyDiscount]);

  const patch = <K extends keyof ProduceListingDraft>(key: K, value: ProduceListingDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const setProduceKind = (kind: ProduceKind) => {
    setDraft((prev) => ({
      ...prev,
      produceKind: kind,
      productName: '',
      stockUnit: kind === 'crop' ? 'kg' : 'head',
    }));
    setError(null);
  };

  const addPhoto = async (source: 'camera' | 'library') => {
    if (draft.photos.length >= MAX_PHOTOS) {
      Alert.alert('Photo limit', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera permission', 'Please allow camera access to take a photo.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          aspect: [4, 3],
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          patch('photos', [...draft.photos, result.assets[0].uri].slice(0, MAX_PHOTOS));
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Gallery permission', 'Please allow photo library access.');
          return;
        }
        const remaining = MAX_PHOTOS - draft.photos.length;
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          selectionLimit: remaining,
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.length) {
          const uris = result.assets.map((a) => a.uri).filter(Boolean);
          patch('photos', [...draft.photos, ...uris].slice(0, MAX_PHOTOS));
        }
      }
    } catch {
      Alert.alert('Error', 'Could not add photo. Please try again.');
    }
  };

  const removePhoto = (index: number) => {
    patch(
      'photos',
      draft.photos.filter((_, i) => i !== index),
    );
  };

  const validate = (): string | null => {
    if (draft.photos.length < MIN_PHOTOS) return 'Add at least 1 photo (up to 3).';
    if (!draft.title.trim()) return 'Enter a listing title.';
    if (!draft.productName) {
      return draft.produceKind === 'crop' ? 'Select a crop.' : 'Select livestock.';
    }
    if (!draft.stockQty.trim() || Number(draft.stockQty) <= 0) {
      return 'Enter quantity in stock.';
    }
    if (!draft.price.trim() || Number(draft.price.replace(/,/g, '')) <= 0) {
      return 'Enter a valid price in UGX.';
    }
    const discount = Number.parseFloat(draft.discountPercent);
    if (
      draft.applyDiscount &&
      draft.discountPercent.trim() &&
      (!Number.isFinite(discount) || discount < 1 || discount > 99)
    ) {
      return 'Discount must be between 1 and 99%.';
    }
    if (!draft.location.trim()) return 'Enter location / district.';
    if (!draft.contactPhone.trim()) return 'Enter a contact phone number.';
    if (!draft.description.trim() || draft.description.trim().length < 20) {
      return 'Add a description (at least 20 characters).';
    }
    if (
      (draft.saleChannel === 'wholesale' || draft.saleChannel === 'both') &&
      draft.minOrderQty.trim() &&
      Number(draft.minOrderQty) <= 0
    ) {
      return 'Minimum order must be a positive number.';
    }
    return null;
  };

  const handleSubmit = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    const listing: SubmittedProduceListing = {
      ...draft,
      title: draft.title.trim(),
      brand: draft.brand.trim(),
      location: draft.location.trim(),
      contactPhone: draft.contactPhone.trim(),
      description: draft.description.trim(),
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    onSubmit(listing);
    setSubmitting(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Post produce listing</Text>
        <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={24} color={palette.text.secondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Photos */}
        <Text style={styles.sectionLabel}>Photos * (1–3)</Text>
        <View style={styles.photoRow}>
          {draft.photos.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.photoThumb}>
              <Image source={{ uri }} style={styles.photoImage} />
              <Pressable
                style={styles.photoRemove}
                onPress={() => removePhoto(index)}
                accessibilityLabel="Remove photo"
              >
                <MaterialCommunityIcons name="close-circle" size={22} color={palette.danger} />
              </Pressable>
              {index === 0 && (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverBadgeText}>Cover</Text>
                </View>
              )}
            </View>
          ))}
          {draft.photos.length < MAX_PHOTOS && (
            <View style={styles.addPhotoCol}>
              <Pressable style={styles.addPhotoBtn} onPress={() => addPhoto('library')}>
                <MaterialCommunityIcons name="image-plus" size={22} color={palette.brandGreen} />
                <Text style={styles.addPhotoText}>Gallery</Text>
              </Pressable>
              <Pressable style={styles.addPhotoBtn} onPress={() => addPhoto('camera')}>
                <MaterialCommunityIcons name="camera-plus" size={22} color={palette.brandGreen} />
                <Text style={styles.addPhotoText}>Camera</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.fieldLabel}>Title *</Text>
        <TextInput
          style={styles.fieldInput}
          value={draft.title}
          onChangeText={(t) => patch('title', t)}
          placeholder="e.g. Fresh dry maize — Grade A"
          placeholderTextColor={palette.text.tertiary}
        />

        {/* Type */}
        <Text style={styles.fieldLabel}>Produce type *</Text>
        <View style={styles.chipRow}>
          {([
            { value: 'crop' as const, label: 'Crop', icon: 'sprout' as const },
            { value: 'livestock' as const, label: 'Livestock', icon: 'cow' as const },
          ]).map((opt) => {
            const active = draft.produceKind === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setProduceKind(opt.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={16}
                  color={active ? palette.white : palette.brandGreen}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Product list */}
        <Text style={styles.fieldLabel}>
          {draft.produceKind === 'crop' ? 'Crop *' : 'Livestock *'}
        </Text>
        <View style={styles.wrapChips}>
          {productOptions.map((name) => {
            const active = draft.productName === name;
            return (
              <Pressable
                key={name}
                onPress={() => patch('productName', name)}
                style={[styles.smallChip, active && styles.smallChipActive]}
              >
                <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Quality */}
        <Text style={styles.fieldLabel}>Quality *</Text>
        <View style={styles.chipRow}>
          {QUALITY_OPTIONS.map((opt) => {
            const active = draft.quality === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => patch('quality', opt.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Stock */}
        <Text style={styles.fieldLabel}>Quantity in stock *</Text>
        <View style={styles.row2}>
          <TextInput
            style={[styles.fieldInput, styles.flex1]}
            value={draft.stockQty}
            onChangeText={(t) => patch('stockQty', t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="e.g. 200"
            placeholderTextColor={palette.text.tertiary}
          />
          <View style={styles.unitWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {unitOptions.map((unit) => {
                const active = draft.stockUnit === unit;
                return (
                  <Pressable
                    key={unit}
                    onPress={() => patch('stockUnit', unit)}
                    style={[styles.unitChip, active && styles.unitChipActive]}
                  >
                    <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>
                      {unit}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Sale channel */}
        <Text style={styles.fieldLabel}>Selling as *</Text>
        <View style={styles.chipRow}>
          {SALE_OPTIONS.map((opt) => {
            const active = draft.saleChannel === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => patch('saleChannel', opt.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {(draft.saleChannel === 'wholesale' || draft.saleChannel === 'both') && (
          <>
            <Text style={styles.fieldLabel}>Minimum order (wholesale)</Text>
            <TextInput
              style={styles.fieldInput}
              value={draft.minOrderQty}
              onChangeText={(t) => patch('minOrderQty', t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={`e.g. 50 ${draft.stockUnit}`}
              placeholderTextColor={palette.text.tertiary}
            />
          </>
        )}

        {/* Brand */}
        <Text style={styles.fieldLabel}>Brand (optional)</Text>
        <TextInput
          style={styles.fieldInput}
          value={draft.brand}
          onChangeText={(t) => patch('brand', t)}
          placeholder="Farm or brand name"
          placeholderTextColor={palette.text.tertiary}
        />

        {/* Price + discount */}
        <Text style={styles.fieldLabel}>Selling price (UGX) *</Text>
        <TextInput
          style={styles.fieldInput}
          value={draft.price}
          onChangeText={(t) => patch('price', t.replace(/[^0-9,.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="e.g. 1200"
          placeholderTextColor={palette.text.tertiary}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Apply discount</Text>
          <Switch
            value={draft.applyDiscount}
            onValueChange={(v) => {
              patch('applyDiscount', v);
              if (v && !draft.discountPercent.trim()) patch('discountPercent', '10');
            }}
            trackColor={{ true: palette.brandGreenLight, false: palette.border.medium }}
            thumbColor={draft.applyDiscount ? palette.brandGreen : palette.white}
          />
        </View>
        {draft.applyDiscount ? (
          <>
            <Text style={styles.fieldLabel}>Discount %</Text>
            <TextInput
              style={styles.fieldInput}
              value={draft.discountPercent}
              onChangeText={(t) => patch('discountPercent', t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="e.g. 10"
              placeholderTextColor={palette.text.tertiary}
            />
            {listPreview?.list != null ? (
              <Text style={styles.hint}>
                Was UGX {Math.round(listPreview.list).toLocaleString()} · Now UGX{' '}
                {Math.round(listPreview.selling).toLocaleString()} (−{listPreview.pct}%)
              </Text>
            ) : null}
          </>
        ) : null}

        {/* VAT */}
        <Text style={styles.fieldLabel}>VAT *</Text>
        <View style={styles.wrapChips}>
          {VAT_OPTIONS.map((opt) => {
            const active = draft.vatMode === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => patch('vatMode', opt.value)}
                style={[styles.smallChip, active && styles.smallChipActive]}
              >
                <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Location & dates */}
        <Text style={styles.fieldLabel}>Location / district *</Text>
        <TextInput
          style={styles.fieldInput}
          value={draft.location}
          onChangeText={(t) => patch('location', t)}
          placeholder="e.g. Tororo"
          placeholderTextColor={palette.text.tertiary}
        />

        <Text style={styles.fieldLabel}>Harvest / available date</Text>
        <TextInput
          style={styles.fieldInput}
          value={draft.harvestDate}
          onChangeText={(t) => patch('harvestDate', t)}
          placeholder="e.g. Ready now · or 2026-08-15"
          placeholderTextColor={palette.text.tertiary}
        />

        <Text style={styles.fieldLabel}>Contact phone *</Text>
        <TextInput
          style={styles.fieldInput}
          value={draft.contactPhone}
          onChangeText={(t) => patch('contactPhone', t)}
          keyboardType="phone-pad"
          placeholder="07XXXXXXXX"
          placeholderTextColor={palette.text.tertiary}
        />

        {/* Toggles */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Organic / certified</Text>
          <Switch
            value={draft.organic}
            onValueChange={(v) => patch('organic', v)}
            trackColor={{ true: palette.brandGreenLight, false: palette.border.medium }}
            thumbColor={draft.organic ? palette.brandGreen : palette.white}
          />
        </View>

        <Text style={styles.fieldLabel}>Delivery *</Text>
        <View style={styles.wrapChips}>
          {(
            [
              { value: 'free' as const, label: 'Free delivery' },
              { value: 'paid' as const, label: 'Delivered at a fee' },
            ] as const
          ).map((opt) => {
            const active = draft.deliveryMode === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => patch('deliveryMode', opt.value)}
                style={[styles.smallChip, active && styles.smallChipActive]}
              >
                <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Delivery period *</Text>
        <View style={styles.wrapChips}>
          {(Object.keys(DELIVERY_PERIOD_LABELS) as DeliveryPeriod[]).map((key) => {
            const active = draft.deliveryPeriod === key;
            return (
              <Pressable
                key={key}
                onPress={() => patch('deliveryPeriod', key)}
                style={[styles.smallChip, active && styles.smallChipActive]}
              >
                <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>
                  {DELIVERY_PERIOD_LABELS[key]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Description */}
        <Text style={styles.fieldLabel}>Description *</Text>
        <TextInput
          style={[styles.fieldInput, styles.textArea]}
          value={draft.description}
          onChangeText={(t) => patch('description', t)}
          placeholder="Condition, packaging, pickup details, payment terms…"
          placeholderTextColor={palette.text.tertiary}
          multiline
          textAlignVertical="top"
        />

        {error ? (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle" size={18} color={palette.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>Submit listing</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '94%',
    paddingBottom: 12,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  formTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: palette.text.primary,
  },
  scroll: { maxHeight: '100%' },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: 4,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.text.secondary,
    marginTop: 8,
    marginBottom: 8,
  },
  fieldLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.text.secondary,
    marginTop: 12,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: palette.border.light,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: palette.text.primary,
    backgroundColor: palette.surface.secondary,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: palette.surface.secondary,
  },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 11,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: palette.brandGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
    color: palette.white,
  },
  addPhotoCol: { gap: 8 },
  addPhotoBtn: {
    width: 88,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border.green,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    backgroundColor: palette.tint[50],
  },
  addPhotoText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: palette.brandGreen,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  chipActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreen,
  },
  chipText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.text.secondary,
  },
  chipTextActive: { color: palette.white },
  wrapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  smallChipActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreen,
  },
  smallChipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: palette.text.secondary,
  },
  smallChipTextActive: { color: palette.white },
  row2: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  flex1: { flex: 1 },
  unitWrap: { flex: 1.2 },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginRight: 6,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  unitChipActive: {
    backgroundColor: palette.tint[100],
    borderColor: palette.brandGreen,
  },
  unitChipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: palette.text.secondary,
  },
  unitChipTextActive: { color: palette.brandGreenDark },
  hint: {
    marginTop: 4,
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: palette.brandGreen,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 4,
  },
  switchLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.text.primary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.ui.errorBg,
    borderWidth: 1,
    borderColor: palette.ui.errorBorder,
  },
  errorText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: palette.ui.errorText,
  },
  submitBtn: {
    marginTop: 18,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.white,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.text.secondary,
  },
});
