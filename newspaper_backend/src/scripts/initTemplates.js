require('dotenv').config();
const mongoose = require('mongoose');
const Template = require('../models/Template');

const defaultTemplate = {
  name: 'Стандартная 3-колоночная страница',
  description: 'Базовый шаблон с тремя колонками и местом под рекламу',
  columns: 3,
  adSlots: [
    {
      id: 'ad_bottom',
      x: 5,
      y: 85,
      width: 90,
      height: 10,
      allowedContentTypes: ['image', 'text'],
    },
  ],
  illustrationPositions: [
    {
      id: 'illus_col0',
      allowedColumns: [0],
      maxWidth: 100,
      maxHeight: 200,
      textWrapping: 'around',
    },
    {
      id: 'illus_col1',
      allowedColumns: [1],
      maxWidth: 100,
      maxHeight: 200,
      textWrapping: 'around',
    },
    {
      id: 'illus_col2',
      allowedColumns: [2],
      maxWidth: 100,
      maxHeight: 200,
      textWrapping: 'around',
    },
  ],
  margins: {
    top: 10,
    bottom: 10,
    left: 5,
    right: 5,
  },
  headers: {
    content: 'Заголовок газеты',
    height: 5,
  },
  footers: {
    content: 'Номер страницы',
    height: 3,
  },
  textFlowRules: {
    wrapAroundIllustrations: true,
    wrapAroundAds: false,
    multiColumnContinuation: true,
  },
};

const initTemplates = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env file');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const exists = await Template.findOne({ name: defaultTemplate.name });
    if (exists) {
      console.log('⚠️  Default template already exists, skipping...');
    } else {
      await Template.create(defaultTemplate);
      console.log('✅ Default template created');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing templates:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

initTemplates();

