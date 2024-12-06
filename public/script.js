const socket = io('http://localhost:3000'); // Подключение к WebSocket серверу
const displayedAds = new Set(); // Храним уже показанные объявления

// Уведомление о подключении и отключении
socket.on('connect', () => {
  console.log('Подключение WebSocket установлено');
});

socket.on('disconnect', () => {
  console.log('Подключение WebSocket потеряно');
});

socket.on('update-ad', (updatedAd) => {
  // Обновляем объявление в списке
  console.log('Получено обновленное объявление:', updatedAd);
});

// Слушаем новые объявления
socket.on('new-ad', (ad) => {
  if (displayedAds.has(ad.url)) {
    console.log('Дубликат объявления, пропускаем:', ad.url);
    return; // Если объявление уже отображено, пропускаем
  }

  displayedAds.add(ad.url); // Добавляем URL в Set
  console.log('Новое объявление получено:', ad);
  displayAd(ad, true); // Отображаем новое объявление с подсветкой
});

// Включение/выключение парсинга
const parsingToggle = document.getElementById('parsing-toggle');
parsingToggle.addEventListener('change', () => {
  const state = parsingToggle.checked;
  fetch('/set-parsing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(`Парсинг ${data.isParsing ? 'включен' : 'выключен'}`);
    })
    .catch((error) => console.error('Ошибка при изменении состояния парсинга:', error));
});


// Массив для хранения фильтров
let filters = [];
let message = "";

// Функция для отображения списка фильтров
function displayFilters() {
  console.log('Функция displayFilters вызвана');
  const filterList = document.getElementById('filter-list');
  if (!filterList) {
    console.error('Элемент filter-list не найден');
    return;
  }
  filterList.innerHTML = ''; // Очищаем список

  fetch('/filters')
    .then((response) => response.json())
    .then((data) => {
      console.log('Фильтры с сервера:', data.filters); // Логируем данные
      filters = data.filters;
      filters.forEach((filter) => {
        const li = document.createElement('li');
        li.classList.add('filter-item'); // Классу li присваиваем стиль для flex

        const link = document.createElement('span');
        link.classList.add('ad-link');
        link.textContent = filter.url;

        // Кнопка для активации/деактивации
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = filter.isActive ? 'Деактивировать' : 'Активировать';
        toggleBtn.addEventListener('click', () => toggleFilter(filter._id, !filter.isActive));

        // Кнопка для удаления фильтра
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Удалить';
        deleteBtn.addEventListener('click', () => deleteFilter(filter._id));

        // Добавляем ссылку и кнопки в контейнер
        li.appendChild(link);
        li.appendChild(toggleBtn);
        li.appendChild(deleteBtn);

        // Добавляем фильтр в список
        filterList.appendChild(li);
      });
    })
    .catch((error) => console.error('Ошибка при загрузке фильтров:', error));
}



// Переключение активации фильтра
function toggleFilter(id, isActive) {
  fetch('/toggle-filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, isActive }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        displayFilters(); // Обновляем список
      } else {
        alert('Не удалось изменить состояние фильтра.');
      }
    })
    .catch((error) => console.error('Ошибка при переключении фильтра:', error));
}

// Удаление фильтра
function deleteFilter(id) {
  fetch(`/delete-filter/${id}`, { method: 'DELETE' })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert('Фильтр удален.');
        displayFilters(); // Обновляем список
      } else {
        alert('Не удалось удалить фильтр.');
      }
    })
    .catch((error) => console.error('Ошибка при удалении фильтра:', error));
}

// Загружаем список фильтров при старте страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log('Скрипт загружен, вызывается DOMContentLoaded');
  displayFilters();
});


// Функция для добавления фильтра
document.getElementById('add-filter-btn').addEventListener('click', function () {
  const filterUrl = document.getElementById('filter-url').value;
  if (filterUrl) {
    // Отправляем фильтр на сервер
    fetch('/add-filter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: filterUrl }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert(data.message);
          displayFilters(); // Обновляем список фильтров
        } else {
          alert(data.message || 'Ошибка при добавлении фильтра.');
        }
      })
      .catch((error) => {
        console.error('Ошибка при добавлении фильтра:', error);
        alert('Ошибка при добавлении фильтра.');
      });
  } else {
    alert('Пожалуйста, введите URL фильтра.');
  }
});

// Сохранение частоты опроса
const saveIntervalBtn = document.getElementById('save-interval-btn');
saveIntervalBtn.addEventListener('click', () => {
  const interval = parseInt(document.getElementById('polling-interval').value, 10);

  if (interval < 1) {
    alert('Частота должна быть больше 0 секунд.');
    return;
  }

  fetch('/set-interval', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ interval }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert(`Частота опроса установлена на ${data.interval} секунд.`);
      } else {
        alert('Не удалось изменить частоту опроса.');
      }
    })
    .catch((error) => {
      console.error('Ошибка при изменении частоты опроса:', error);
    });
});

// Запрос объявлений с сервера при загрузке страницы
function fetchAndDisplayAds() {
  fetch('/ads')
    .then((response) => response.json())
    .then((ads) => {
      console.log('Загруженные объявления:', ads);
      const adList = document.getElementById('ad-list');
      adList.innerHTML = ''; // Очищаем список перед рендерингом

      ads.forEach((ad) => {
        displayedAds.add(ad.url); // Добавляем URL в Set
        displayAd(ad); // Отображаем объявления
      });
    })
    .catch((error) => {
      console.error('Ошибка при загрузке объявлений:', error);
    });
}

// Вызов функции при загрузке страницы
window.onload = () => {
  fetchAndDisplayAds();
};



function displayAd(ad, isNew = false) {
  const adList = document.getElementById('ad-list');
  if (!adList) {
    console.error('Элемент ad-list не найден');
    return;
  }

  const adItem = document.createElement('div'); // Создаем элемент объявления
  adItem.classList.add('announcement'); // Класс для стилизации
  if (isNew) {
    adItem.classList.add('new-ad'); // Добавляем подсветку для новых объявлений
  }
  adItem.innerHTML = `
    <a href="${ad.url}" target="_blank" class="ad-link">
      <img src="${ad.imageUrl || 'placeholder.jpg'}" alt="${ad.title}" class="ad-image">
    </a>
    <h3 class="ad-title">${ad.title}</h3>
    <p class="ad-price">Цена: ${ad.price}</p>
    <p class="ad-location">Местоположение: ${ad.location}</p>
    <p class="ad-date">Опубликовано: ${ad.date}</p>
    <a href="${ad.url}" target="_blank" class="ad-button">
      <button class="view-ad-button">Посмотреть объявление</button>
    </a>
  `;

  adList.prepend(adItem); // Добавляем новое объявление в начало списка
}


// Проверка, поддерживает ли браузер уведомления
if ('Notification' in window) {
  // Запрос на разрешение уведомлений
  Notification.requestPermission().then((permission) => {
    if (permission === 'granted') {
      console.log('Разрешение на уведомления получено');
    } else {
      console.log('Разрешение на уведомления отклонено');
    }
  });
} else {
  console.log('Браузер не поддерживает системные уведомления');
}



// Функция для показа системного уведомления
function showNotification(ad) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Новое объявление на Avito', {
      body: `${ad.title} - ${ad.price}`,
      icon: ad.imageUrl || 'placeholder.jpg', // Используем изображение объявления (если есть)
    });

    // Уведомление автоматически исчезнет через 4 секунды
    setTimeout(() => {
      notification.close();
    }, 4000);
  } else {
    console.log('Уведомления не поддерживаются или не разрешены.');
  }
}

