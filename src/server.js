const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors')
const Ad = require('./models/adModel');
const Filter = require('./models/filterModel');
const scrapeAvito = require('./services/avitoScraper');
let isParsing = false; // Состояние парсинга (по умолчанию выключен)
let pollingInterval = 10000; // Частоlet currentFilters = []; // Хранение текущих фильтров
let currentFilters = []; // Хранение текущих фильтров


const app = express();
const server = http.createServer(app);
const io = socketIo(server, { // Настройка WebSocket
  cors: {
    origin: '*', // Разрешить все источники
    methods: ['GET', 'POST'], // Разрешенные методы
  }
});


app.use(express.json());
app.use(express.static('public')); // Статические файлы для фронтенда
app.use(cors())

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/avito-monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// При запуске сервера загружаем текущие фильтры
(async () => {
  try {
    currentFilters = await Filter.find();
    console.log('Текущие фильтры при старте сервера:', currentFilters);
  } catch (error) {
    console.error('Ошибка при загрузке фильтров при старте сервера:', error);
  }
})();


// Обработчик WebSocket-соединений
io.on('connection', (socket) => {
  console.log('Клиент подключился');

  socket.on('disconnect', () => {
    console.log('Клиент отключился');
  });
});

const Batch = require('./models/batchModel');

// Функция для парсинга и добавления объявлений
async function parseAndSaveAds(ads) {
  for (const ad of ads) {
    // Проверяем существование объявления в базе данных
    const existingAd = await Ad.findOne({ url: ad.url });

    if (!existingAd) {
      // Сохраняем новое объявление в базу
      const newAd = await Ad.create(ad);
      console.log('Новое объявление добавлено в базу:', newAd);

      // Отправляем новое объявление всем подключенным клиентам через WebSocket
      io.emit('new-ad', newAd); // Передача нового объявления клиенту
      console.log('Новое объявление отправлено клиенту:', newAd);
    } else {
      // Проверяем, изменились ли данные объявления
      const updatedFields = {};

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

        // Передаем обновленное объявление клиентам
        io.emit('update-ad', updatedAd);
        console.log('Обновленное объявление отправлено клиенту:', updatedAd);
      }
    }
  }
}


app.get('/filters', async (req, res) => {
  try {
    const filters = await Filter.find(); // Получаем все фильтры
    console.log('Фильтры из базы данных:', filters); // Логируем полученные данные
    res.json({ filters }); // Отправляем их в формате JSON
  } catch (error) {
    console.error('Ошибка при получении фильтров:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
});


// Маршрут для управления парсингом
app.post('/set-parsing', (req, res) => {
  const { state } = req.body; // Получаем новое состояние
  isParsing = state;
  console.log(`Состояние парсинга изменено: ${isParsing ? 'включено' : 'выключено'}`);
  res.json({ success: true, isParsing });
});

// Маршрут для изменения частоты опроса
app.post('/set-interval', (req, res) => {
  const { interval } = req.body;

  if (interval < 1) {
    return res.status(400).json({ success: false, message: 'Частота должна быть больше 0 секунд.' });
  }

  pollingInterval = interval * 1000; // Конвертируем в миллисекунды
  console.log(`Частота опроса изменена на ${pollingInterval / 1000} секунд.`);
  res.json({ success: true, interval });
});

// Маршрут для установки режима работы
app.post('/set-mode', (req, res) => {
  const { mode } = req.body; // Получаем режим (true/false)
  onlyNewAds = mode;
  console.log(`Режим работы изменен: ${onlyNewAds ? 'только новые' : 'обычный'}`);
  res.json({ success: true, onlyNewAds });
});

// Функция для мониторинга фильтров
async function monitorFilters() {
  if (!isParsing) {
    console.log('Парсинг выключен. Ожидание включения...');
    setTimeout(monitorFilters, pollingInterval);
    return;
  }

  // Загружаем только активные фильтры
  currentFilters = await Filter.find({ isActive: true });

  if (currentFilters.length === 0) {
    console.log('Нет активных фильтров для парсинга.');
    setTimeout(monitorFilters, pollingInterval);
    return;
  }

  let filterIndex = 0;

  const parseNextFilter = async () => {
    if (!isParsing) {
      console.log('Парсинг отключен.');
      setTimeout(monitorFilters, pollingInterval);
      return;
    }

    const filter = currentFilters[filterIndex];
    console.log(`Парсим объявления для фильтра: ${filter.url}`);

    try {
      const ads = await scrapeAvito(filter.url);
      console.log(`Найдено ${ads.length} объявлений для фильтра ${filter.url}`);
      await parseAndSaveAds(ads);
    } catch (error) {
      console.error(`Ошибка при парсинге фильтра ${filter.url}:`, error);
    }

    filterIndex = (filterIndex + 1) % currentFilters.length;
    setTimeout(parseNextFilter, pollingInterval);
  };

  parseNextFilter();
}



// Стартуем мониторинг фильтров
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

app.post('/toggle-filter', async (req, res) => {
  const { id, isActive } = req.body;

  try {
    const filter = await Filter.findByIdAndUpdate(
      id,
      { isActive },
      { new: true } // Возвращаем обновленный документ
    );

    if (!filter) {
      return res.status(404).json({ success: false, message: 'Фильтр не найден.' });
    }

    // Обновляем текущие фильтры
    currentFilters = await Filter.find({ isActive: true });
    console.log('Список активных фильтров обновлен:', currentFilters);

    res.json({ success: true, filter });
  } catch (error) {
    console.error('Ошибка при изменении состояния фильтра:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера.' });
  }
});

app.delete('/delete-filter/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const filter = await Filter.findByIdAndDelete(id);

    if (!filter) {
      return res.status(404).json({ success: false, message: 'Фильтр не найден.' });
    }

    // Обновляем текущие фильтры
    currentFilters = await Filter.find({ isActive: true });
    console.log('Список активных фильтров обновлен:', currentFilters);

    res.json({ success: true, message: 'Фильтр удален.' });
  } catch (error) {
    console.error('Ошибка при удалении фильтра:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера.' });
  }
});



// Маршрут для добавления нового фильтра и запуска парсинга
app.post('/add-filter', async (req, res) => {
  const { url } = req.body;
  try {
    // Проверяем, существует ли такой фильтр
    const existingFilter = await Filter.findOne({ url });
    if (existingFilter) {
      return res.status(400).json({ success: false, message: 'Этот фильтр уже добавлен.' });
    }

    // Сохраняем новый фильтр
    const filter = new Filter({ url });
    await filter.save();

    // Обновляем список текущих фильтров
    currentFilters = await Filter.find(); // Загружаем новые фильтры
    console.log('Список фильтров обновлен:', currentFilters);

    res.status(200).json({ success: true, message: 'Фильтр добавлен и объявления обработаны.' });
  } catch (error) {
    console.error('Ошибка при добавлении фильтра:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера.' });
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
