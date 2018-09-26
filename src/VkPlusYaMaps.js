function vkApi(method, options) {
    if (!options.v) {
        options.v = '5.68';
    }

    return new Promise((resolve, reject) => {
        VK.api(method, options, data => {
            if (data.error) {
                reject(new Error(data.error.error_msg));
            } else {
                resolve(data.response);
            }
        });
    });
}

function vkInit() {
    return new Promise((resolve, reject) => {
        VK.init({
            apiId: 6699905
        });

        VK.Auth.login(data => {
            if (data.session) {
                resolve();
            } else {
                reject(new Error('Не удалось авторизоваться'));
            }
        }, 2 | 4 | 8);
    });
}

function findGeoCodeForFriend(address, friend) {
    return ymaps.geocode(address)
        .then(result => {
            const points = result.geoObjects.toArray();

            if (points.length) {
                friend.geoPoints = points[0].geometry.getCoordinates();

                return friend;
            }
        });
}

let myMap;
let clusterer;

new Promise(resolve => ymaps.ready(resolve)) // ждем загрузку карты
    .then(() => vkInit()) // авторизация источника данных
    .then(() => vkApi('friends.get', { fields: 'city, country, photo_50, domain' })) // получаем список записей
    .then(friends => {
        myMap = new ymaps.Map('map', {
            center: [55.76, 37.64], // Москва
            zoom: 5
        }, {
            searchControlProvider: 'yandex#search'
        });

        return friends.items;
    }) // инициализация карты
    .then(friends => {

        const friendsWithAdress = friends.filter(friend => friend.country && friend.country.title);

        friendsWithAdress
            .forEach(friend => {
                let address = friend.country.title;

                if (friend.city) {
                    address += ' ' + friend.city.title;
                }
                friend.address = address;
            });

        const promises = friendsWithAdress
            .map(friend => {
                return findGeoCodeForFriend(friend.address, friend);
            });

        return Promise.all(promises);
    }) // получение адресов и координат
    .then(friends => {
        const placemarks = friends.map(friend => {
            let href = 'https://vk.com/' + friend.domain;
            let params = {
                // Зададим содержимое заголовка балуна.
                balloonContentHeader: `<span>${friend.first_name}  ${friend.last_name}</span>`,
                // Зададим содержимое основной части балуна.
                balloonContentBody:
                    `<img src= ${friend.photo_50} height="50" width="50"><a href =${href} target="_blank"><br/> 
                    <a href =${href} target="_blank">${friend.first_name}  ${friend.last_name}</a><br>
                    <b>${friend.address}</b> <br/>`,
                // Зададим содержимое всплывающей подсказки.
                hintContent: `${friend.first_name} ${friend.last_name}`
            };

            return new ymaps.Placemark(friend.geoPoints, params);
        });

        clusterer = createMapCluster();
        myMap.geoObjects.add(clusterer);

        placemarks.forEach(placemark => {
            myMap.geoObjects.add(placemark);
        });
        clusterer.add(placemarks);
    }) // добавляем гео-объекты на карту
    .catch(e => alert('Ошибка: ' + e.message));

function createMapCluster() {
    let customItemContentLayout = ymaps.templateLayoutFactory.createClass(
        // Флаг "raw" означает, что данные вставляют "как есть" без экранирования html.
        '<h2>{{ properties.balloonContentHeader|raw }}</h2>' +
        '<div>{{ properties.balloonContentBody|raw }}</div>'
    );

    return new ymaps.Clusterer({
        preset: 'islands#invertedVioletClusterIcons',
        clusterDisableClickZoom: true,
        clusterOpenBalloonOnClick: true,
        // Устанавливаем режим открытия балуна.
        // В данном примере балун никогда не будет открываться в режиме панели.
        clusterBalloonPanelMaxMapArea: 0,
        // Устанавливаем размер макета контента балуна (в пикселях).
        clusterBalloonContentLayoutWidth: 350,
        // Устанавливаем собственный макет.
        clusterBalloonItemContentLayout: customItemContentLayout,
        // Устанавливаем ширину левой колонки, в которой располагается список всех геообъектов кластера.
        clusterBalloonLeftColumnWidth: 120
    });
}