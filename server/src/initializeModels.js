import { genresOf } from '../../shared/genres.js';
import * as models from './models/index.js';

export async function initializeModels() {
  // Repair both legacy strings and arrays containing serialized JSON genre lists.
  const cursor = models.Sach.collection.find({}, { projection: { TheLoai: 1 } });
  let operations = [];
  for await (const book of cursor) {
    const genres = genresOf(book.TheLoai);
    if (genres.length && JSON.stringify(genres) !== JSON.stringify(book.TheLoai)) {
      operations.push({
        updateOne: {
          filter: { _id: book._id, TheLoai: book.TheLoai },
          update: { $set: { TheLoai: genres } },
        },
      });
    }
    if (operations.length >= 200) {
      await models.Sach.collection.bulkWrite(operations);
      operations = [];
    }
  }
  if (operations.length) await models.Sach.collection.bulkWrite(operations);
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
