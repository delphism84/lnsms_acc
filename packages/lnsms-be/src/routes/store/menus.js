const express = require('express');
const router = express.Router();
const Menu = require('../../models/Menu');
const Category = require('../../models/Category');
const { emitChanged } = require('../../ws/gateway');

function storeRefId(req) {
  return req.storeScope.storeRef;
}

async function findOwnedMenu(req, menuId) {
  const menu = await Menu.findById(menuId);
  if (!menu) return null;
  if (String(menu.storeId) !== String(storeRefId(req))) return null;
  return menu;
}

router.get('/', async (req, res, next) => {
  try {
    const menus = await Menu.find({ storeId: storeRefId(req) })
      .sort({ order: 1, createdAt: 1 })
      .populate('categoryId', 'name');
    res.json(menus);
  } catch (err) {
    next(err);
  }
});

router.get('/category/:categoryId', async (req, res, next) => {
  try {
    const cat = await Category.findById(req.params.categoryId);
    if (!cat || String(cat.storeId) !== String(storeRefId(req))) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const menus = await Menu.find({ categoryId: req.params.categoryId, storeId: storeRefId(req) })
      .sort({ order: 1, createdAt: 1 })
      .populate('categoryId', 'name');
    res.json(menus);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const menu = await findOwnedMenu(req, req.params.id);
    if (!menu) return res.status(404).json({ error: 'Menu not found' });
    await menu.populate('categoryId', 'name');
    res.json(menu);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const menu = new Menu({ ...req.body, storeId: storeRefId(req) });
    await menu.save();
    emitChanged(req, 'menus', 'create', String(menu._id));
    res.status(201).json(menu);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await findOwnedMenu(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Menu not found' });
    const menu = await Menu.findByIdAndUpdate(
      req.params.id,
      { ...req.body, storeId: storeRefId(req) },
      { new: true, runValidators: true }
    );
    emitChanged(req, 'menus', 'update', String(menu._id));
    res.json(menu);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await findOwnedMenu(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Menu not found' });
    await Menu.findByIdAndDelete(req.params.id);
    emitChanged(req, 'menus', 'delete', String(req.params.id));
    res.json({ message: 'Menu deleted successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/resources', async (req, res, next) => {
  try {
    const menu = await findOwnedMenu(req, req.params.id);
    if (!menu) return res.status(404).json({ error: 'Menu not found' });
    menu.resources.push(req.body);
    await menu.save();
    await menu.populate('categoryId', 'name');
    emitChanged(req, 'menus', 'update', String(menu._id));
    res.json(menu);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/resources/:resourceIndex', async (req, res, next) => {
  try {
    const menu = await findOwnedMenu(req, req.params.id);
    if (!menu) return res.status(404).json({ error: 'Menu not found' });
    const resourceIndex = parseInt(req.params.resourceIndex, 10);
    if (resourceIndex < 0 || resourceIndex >= menu.resources.length) {
      return res.status(400).json({ error: 'Invalid resource index' });
    }
    menu.resources.splice(resourceIndex, 1);
    await menu.save();
    await menu.populate('categoryId', 'name');
    emitChanged(req, 'menus', 'update', String(menu._id));
    res.json(menu);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
