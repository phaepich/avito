const socket = io('http://localhost:3000'); // Подключение к WebSocket серверу
const displayedAds = new Set(); // Храним уже показанные объявления
let currentBatch = 1; // Текущий номер партии

// Уведомление о подключении и отключении
socket.on('connect', () => {
  console.log('Подключение WebSocket установлено');
});

socket.on('disconnect', () => {
  console.log('Подключение WebSocket потеряно');
});

socket.on('update-ad', (updatedAd) => {
  // Обновляем объявление в списке (например, через DOM или state-фреймворк)
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

// Массив для хранения фильтров
let filters = [];
let message = "";

// Функция для добавления фильтра
document.getElementById('add-filter-btn').addEventListener('click', function() {
  const filterUrl = document.getElementById('filter-url').value;
  if (filterUrl) {
    // Отправляем фильтр на сервер для сохранения в базе данных
    fetch('/add-filter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: filterUrl })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert("Фильтр успешно добавлен!");
      } else {
        alert("Произошла ошибка при добавлении фильтра.");
      }
    })
    .catch(error => {
      console.error("Ошибка при добавлении фильтра:", error);
      alert("Ошибка при добавлении фильтра.");
    });
  } else {
    alert("Пожалуйста, введите URL фильтра.");
  }
});
// Функция для отображения фильтров в списке
function displayFilters() {
  const filterList = document.getElementById('filter-list');
  filterList.innerHTML = ''; // Очищаем список
  filters.forEach(filter => {
    const li = document.createElement('li');
    li.textContent = filter;
    filterList.appendChild(li);
  });
}

// Функция для сохранения сообщения
document.getElementById('save-message-btn').addEventListener('click', function() {
  const message = document.getElementById('message-template').value;
  if (message) {
    // Отправляем сообщение на сервер для сохранения (например, в базе данных)
    fetch('/save-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: message })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Отображаем сообщение в блоке на странице
        const statusMessage = document.getElementById('message-status');
        statusMessage.textContent = "Сообщение успешно сохранено!";
        statusMessage.style.color = "green";
      } else {
        alert("Ошибка при сохранении сообщения.");
      }
    })
    .catch(error => {
      console.error("Ошибка при сохранении сообщения:", error);
      alert("Ошибка при сохранении сообщения.");
    });
  } else {
    alert("Пожалуйста, введите сообщение.");
  }
});

// Функция для отображения объявления
function displayAd(ad, isNew = false) {
  const adList = document.getElementById('ad-list');
  if (!adList) {
    console.error('Элемент ad-list не найден');
    return;
  }

  const adItem = document.createElement('div'); // Используем `div` для гибкости
  adItem.classList.add('announcement'); // Класс для стилизации
  if (isNew && ad.batch > currentBatch) {
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
  
  // Добавляем новое объявление в начало списка
  adList.prepend(adItem);
}

// Запрашиваем номер текущей партии
function fetchCurrentBatch() {
  return fetch('http://localhost:3000/current-batch') // Запрос к серверу для текущего номера партии
    .then((response) => response.json())
    .then((data) => {
      console.log('Текущая партия загружена:', data.currentBatch);
      return data.currentBatch;
    })
    .catch((error) => {
      console.error('Ошибка при загрузке текущей партии:', error);
      return 1; // Возвращаем 1 по умолчанию
    });
}

// Запрашиваем последние объявления при загрузке страницы
window.onload = async () => {
  console.log('Запрашиваем текущую партию и последние объявления');
  currentBatch = await fetchCurrentBatch(); // Получаем номер текущей партии

  fetch('http://localhost:3000/ads') // Запрос к серверу для получения всех объявлений
    .then((response) => response.json())
    .then((ads) => {
      console.log('Объявления загружены:', ads);
      ads.forEach((ad) => {
        if (!displayedAds.has(ad.url)) {
          displayedAds.add(ad.url);
          displayAd(ad, ad.batch > currentBatch); // Подсвечиваем только новые объявления
        }
      });
    })
    .catch((error) => {
      console.error('Ошибка при загрузке объявлений:', error);
    });
};
