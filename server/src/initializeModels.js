import * as models from './models/index.js';

export async function initializeModels() {
  // Preserve loan records while extending uniqueness to reservations awaiting pickup.
  const indexes = await models.TheoDoiMuonSach.collection.indexes().catch((error) => {
    if (error.code === 26) return [];
    throw error;
  });
  const active = indexes.find((index) => index.name === 'MaDocGia_1_MaSach_1');
  if (active && !active.partialFilterExpression?.TrangThai?.$in?.includes('ChoNhan')) {
    await models.TheoDoiMuonSach.collection.dropIndex(active.name);
  }
  await Promise.all(Object.values(models).map((model) => model.createIndexes()));
}
