const axios = require('axios');
const cheerio = require('cheerio');

const scrapeAvito = async (url) => {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const ads = [];

    // Парсинг объявлений внутри блока catalog-serp
    $('[data-marker="catalog-serp"] [data-marker="item"]').each((index, element) => {
      const title = $(element).find('[data-marker="item-title"]').text().trim();
      const price = $(element).find('[data-marker="item-price"]').text().trim();
      const location = $(element).find('.geo-root-NrkbV span').text().trim();
      let link = $(element).find('[data-marker="item-title"]').attr('href');
      
      // Убираем параметры из URL (после знака ?)
      link = link.split('?')[0]; // Оставляем только основной URL без параметров

      // Извлечение URL изображения
      const imageElement = $(element).find('[data-marker="item-photo"] img');
      const imageUrl = imageElement.attr('src') || imageElement.attr('data-src') || '';

      // Извлечение даты объявления
      const date = $(element).find('[data-marker="item-date"]').text().trim(); // Дата объявления

      if (title && price && link) {
        ads.push({
          title,
          price,
          location: location || 'Не указано',
          url: `https://www.avito.ru${link}`, // Сохраняем очищенный URL
          imageUrl, // Добавляем URL изображения
          date, // Добавляем дату
        });
      }
    });

    return ads;
  } catch (error) {
    console.error('Ошибка при парсинге:', error);
    return [];
  }
};

module.exports = scrapeAvito;
