const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const Ad = require('./models/adModel');
const Filter = require('./models/filterModel');
const scrapeAvito = require('./services/avitoScraper');

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Настройка WebSocket

app.use(express.json());
app.use(express.static('public')); // Статические файлы для фронтенда

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/avito-monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Обработчик WebSocket-соединений
io.on('connection', (socket) => {
  console.log('Клиент подключился');

  socket.on('disconnect', () => {
    console.log('Клиент отключился');
  });
});

const Batch = require('./models/batchModel');

// Функция для парсинга и добавления объявления
async function parseAndSaveAds(ads) {
  let batchData = await Batch.findOne();
  if (!batchData) {
    batchData = await Batch.create({ currentBatch: 1 }); // Создаем запись, если ее нет
  }

  const currentBatch = batchData.currentBatch;
  for (let ad of ads) {
    // Проверяем существование объявления в базе данных
    const existingAd = await Ad.findOne({ url: ad.url });

    if (!existingAd) {
      // Сохраняем новое объявление в базу
      const newAd = await Ad.create(ad);
      console.log('Новое объявление добавлено в базу:', newAd);

      // Отправляем новое объявление всем подключенным клиентам
      io.emit('new-ad', newAd);
      console.log('Новое объявление отправлено клиенту:', newAd);
    } else {
      // Проверяем, изменились ли данные объявления
      let updatedFields = {};

      if (ad.price !== existingAd.price) {
        updatedFields.price = ad.price;
      }
      if (ad.location !== existingAd.location) {
        updatedFields.location = ad.location;
      }
      if (ad.date !== existingAd.date) {
        updatedFields.date = ad.date;
      }

      // Если есть изменения, обновляем запись в базе
      if (Object.keys(updatedFields).length > 0) {
        const updatedAd = await Ad.findOneAndUpdate(
          { url: ad.url },
          { $set: updatedFields },
          { new: true } // Возвращаем обновленный документ
        );

        console.log('Объявление обновлено:', updatedAd);

        // Отправляем обновление всем подключенным клиентам
        io.emit('update-ad', updatedAd);
        console.log('Обновленное объявление отправлено клиенту:', updatedAd);
      }
    }
  // Увеличиваем номер партии только после обработки новых данных
  await Batch.updateOne({}, { currentBatch: currentBatch + 1 });
  }
}
// Функция для мониторинга фильтров
async function monitorFilters() {
  const filters = await Filter.find(); // Получаем все фильтры из базы данных

  for (const filter of filters) {
    console.log(`Начинаем парсинг для фильтра: ${filter.url}`);
    try {
      const ads = await scrapeAvito(filter.url);
      //console.log('Объявления после парсинга:', ads);
      console.log('parsing done. ads: ',ads.length);
      await parseAndSaveAds(ads); // Проверяем и сохраняем объявления
    } catch (error) {
      console.error(`Ошибка парсинга для фильтра ${filter.url}:`, error);
    }

    // Ждем перед обработкой следующего фильтра
    await new Promise((resolve) => setTimeout(resolve, 20000)); // Задержка 30 секунд
  }

  // Перезапускаем процесс через 1 минуту
  setTimeout(monitorFilters, 10000);
}

monitorFilters();


// Маршрут для получения всех объявлений, отсортированных по времени
app.get('/ads', async (req, res) => {
  try {
    const ads = await Ad.find().sort({ date: -1 }); // Сортируем по времени (новые - первыми)
    res.json(ads); // Отправляем отсортированные объявления в формате JSON
  } catch (error) {
    console.error('Ошибка при получении объявлений:', error);
    res.status(500).json({ message: 'Ошибка при загрузке объявлений' });
  }
});


// Маршрут для добавления нового фильтра и запуска парсинга
app.post('/add-filter', async (req, res) => {
  const { url } = req.body;
  try {
    // Сохраняем фильтр в базе данных
    const filter = new Filter({ url });
    await filter.save();

    // Парсим объявления для фильтра
    const ads = await scrapeAvito(url);
    console.log('Объявления после парсинга:', ads);
    
    await parseAndSaveAds(ads);

    res.status(200).json({ message: 'Filter added and ads parsed.' });
  } catch (error) {
    console.error('Ошибка при добавлении фильтра:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Маршрут для получения текущего номера партии
app.get('/current-batch', async (req, res) => {
  try {
    const batchData = await Batch.findOne();
    if (!batchData) {
      return res.json({ currentBatch: 1 }); // Если записи нет, возвращаем 1
    }

    res.json({ currentBatch: batchData.currentBatch });
  } catch (error) {
    console.error('Ошибка при получении текущей партии:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
