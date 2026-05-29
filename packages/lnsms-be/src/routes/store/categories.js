const express = require('express');
const router = express.Router();
const Category = require('../../models/Category');
const Menu = require('../../models/Menu');

function storeRefId(req) {
  return req.storeScope.storeRef;
}

async function findOwnedCategory(req, categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) return null;
  if (String(category.storeId) !== String(storeRefId(req))) return null;
  return category;
}

router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find({ storeId: storeRefId(req) }).sort({ order: 1, createdAt: 1 });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const category = await findOwnedCategory(req, req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const category = new Category({ ...req.body, storeId: storeRefId(req) });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await findOwnedCategory(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { ...req.body, storeId: storeRefId(req) },
      { new: true, runValidators: true }
    );
    res.json(category);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await findOwnedCategory(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    await Menu.deleteMany({ categoryId: req.params.id, storeId: storeRefId(req) });
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category and associated menus deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
