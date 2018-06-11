export default class Map {

    constructor(id, options = {}, cOptions = {}) {
        this.map = new ymaps.Map(id, options);

        cOptions = Object.assign({
            clusterBalloonItemContentLayout: this.getClusterLayout()
        }, cOptions);
        this.clusterer = new ymaps.Clusterer(cOptions);

        this.points = [];

        if (localStorage.points) {
            this.points = JSON.parse(localStorage.points);
        }

        let myGeoObjects = [];
        for (let i = 0; i < this.points.length; i++) {
            myGeoObjects[i] = this.createPoint(this.points[i].coords, this.points[i]);
        }
        this.clusterer.add(myGeoObjects);

        this.add(this.clusterer);

        if (myGeoObjects.length) {
            this.map.setBounds(this.clusterer.getBounds(), {
                checkZoomRange: true
            });
        }
        // ymaps.layout.storage.add('my#baloonLayout', this.getLayout());
        // ymaps.layout.storage.add('my#baloonContentLayout', this.getContentLayout());
    }

    add(object) {
        this.map.geoObjects.add(object);
    }

    createPoint(coords, data = {}, options = {}) {
        options = Object.assign({
            iconColor: '#ff8663'
        }, options);

        let myPlacemark = new ymaps.Placemark(coords, data, options);

        myPlacemark.events.add('click', (e) => {
            e.preventDefault();
            this.map.balloon.close();

            let coords = e.get('target').geometry.getCoordinates();
            this.coords = coords;

            let data = {
                address: myPlacemark.properties.getAll().address,
                comments: this.getComments(myPlacemark)
            };


            setTimeout(() => { this.showBalloon(data) }, 10);
            // this.showBalloon2(myPlacemark, data);
        });

        return myPlacemark;
    }

    getLayout(data = {}) {
        let template = require(`../template/blocks/modal.hbs`),
            MyBalloonLayout = ymaps.templateLayoutFactory.createClass(template(data), {
                /**
                 * Build an instance of the layout based on the template and add it to the parent HTML element.
                 * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/layout.templateBased.Base.xml#build
                 * @function
                 * @name build
                 */
                build: function() {

                    this.constructor.superclass.build.call(this);

                    this._$element = $('.modal', this.getParentElement());

                    this.applyElementOffset();

                    this._$element.find('#modal-close')
                        .on('click', $.proxy(this.onCloseClick, this));

                    this._$element.find('#comment-form').bind('submit', this.onFormSubmit);
                },

                /**
                 * Removes the contents of the DOM layout.
                 * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/layout.templateBased.Base.xml#clear
                 * @function
                 * @name clear
                 */
                clear: function() {
                    this._$element.find('#modal-close')
                        .off('click');

                    this._$element.find('#comment-form').unbind('submit', this.onFormSubmit);

                    this.constructor.superclass.clear.call(this);
                },

                /**
                 * The method will be called by the API template system when you resize the nested layout.
                 * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout.xml#event-userclose
                 * @function
                 * @name onSublayoutSizeChange
                 */
                onSublayoutSizeChange: function() {
                    MyBalloonLayout.superclass.onSublayoutSizeChange.apply(this, arguments);

                    if (!this._isElement(this._$element)) {
                        return;
                    }

                    this.applyElementOffset();

                    this.events.fire('shapechange');
                },

                /**
                 * We shift the balloon to the "tail", indicating the reference point.
                 * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout.xml#event-userclose
                 * @function
                 * @name applyElementOffset
                 */
                applyElementOffset: function(offset = [0, 0]) {
                    this._$element.css({
                        left: -(this._$element[0].offsetWidth / 2) + offset[0],
                        top: -(this._$element[0].offsetHeight + this._$element.find('.modal__arrow')[0].offsetHeight) + offset[1]
                    });
                },

                /**
                 * Closes the balloon when clicking on the cross, throwing the "userclose" event on the layout.
                 * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout.xml#event-userclose
                 * @function
                 * @name onCloseClick
                 */
                onCloseClick: function(e) {
                    e.preventDefault();

                    this.events.fire('userclose');
                },

                /**
                 * Used for automatic positioning (balloonAutoPan).
                 * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/ILayout.xml#getClientBounds
                 * @function
                 * @name getClientBounds
                 * @returns {Number[][]} Coordinates of the left upper and lower right corners of the template relative to the anchor point.
                 */
                getShape: function() {
                    if (!this._isElement(this._$element)) {
                        return MyBalloonLayout.superclass.getShape.call(this);
                    }

                    let position = this._$element.position();

                    return new ymaps.shape.Rectangle(new ymaps.geometry.pixel.Rectangle([
                        [position.left, position.top],
                        [
                            position.left + this._$element[0].offsetWidth,
                            position.top + this._$element[0].offsetHeight + this._$element.find('.modal__arrow')[0].offsetHeight
                        ]
                    ]));
                },

                /**
                 * We check the presence of the element (in IE and Opera it still may not be).
                 * @function
                 * @private
                 * @name _isElement
                 * @param {jQuery} [element] element.
                 * @returns {Boolean} Flag Availability.
                 */
                _isElement: function(element) {
                    return element && element[0] && element.find('.modal__arrow')[0];
                },

                onFormSubmit: (e) => {
                    e.preventDefault();

                    let point = this.createPoint(this.coords);

                    $(e.target).serializeArray().forEach(function(item) {
                        point.properties.set(item.name, item.value);
                    });

                    let address = this.map.balloon.getData().address;
                    if (!address) {
                        address = this.map.balloon.getData().properties.get('address');
                    }

                    let options = {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        timezone: 'UTC'
                    };
                    let date = new Date().toLocaleString("ru", options);

                    point.properties.set('date', date);
                    point.properties.set('address', address);
                    point.properties.set('coords', this.coords);
                    this.addToClusterer(point);

                    let data = {
                        address: address,
                        comments: this.getComments(point)
                    };

                    this.setBalloon(data);

                    document.querySelector('.comment__list').scrollTop = 9999;

                    let saveData = Object.assign({
                        coords: this.coords
                    }, point.properties.getAll());

                    this.points.push(saveData);
                    localStorage.points = JSON.stringify(this.points);
                }
            });

        return MyBalloonLayout;
    }

    getContentLayout(data = {}) {
        let template = require(`../template/blocks/comment.hbs`);

        return ymaps.templateLayoutFactory.createClass(template(data));
    }

    getClusterLayout() {
        let template = require(`../template/blocks/cluster.hbs`);

        let clusterLayout = ymaps.templateLayoutFactory.createClass(template(), {
            build: function() {
                // First, we call the build method of the parent class.
                clusterLayout.superclass.build.call(this);
                // And after, we perform additional actions.
                $('#open-address-comments').bind('click', this.onLinkClick);
            },

            clear: function() {
                // We perform the actions in reverse order - first we remove the listener,
                // and then call the clear method of the parent class.
                $('#open-address-comments').unbind('click', this.onLinkClick);
                clusterLayout.superclass.clear.call(this);
            },

            onLinkClick: (e) => {
                e.preventDefault();

                let cluster = this.clusterer.balloon.getData().cluster;
                let point = cluster.state.get('activeObject');
                let address = point.properties.getAll().address;

                this.coords = point.geometry.getCoordinates();

                let data = {
                    address: address,
                    comments: this.getComments(point)
                };

                point.options.set('visible', false);
                this.add(point);
                point.options.set('balloonLayout', this.getLayout(data));
                point.options.set('balloonContentLayout', this.getContentLayout(data));
                point.options.set('balloonOffset', [0, -20]);
                point.balloon.open(this.coords, { 'address': address });
            }
        });

        return clusterLayout;
    }

    addToClusterer(object) {
        this.clusterer.add(object);
    }

    getAddress(coords = []) {
        coords = coords || this.coords;

        return new Promise((resolve, reject) => {
            ymaps.geocode(coords).then(res => {
                let firstGeoObject = res.geoObjects.get(0);

                resolve(firstGeoObject.properties.get('text'));
            }, () => {
                reject('Не определено');
            });
        });
    }

    showBalloon(data = {}) {
        this.setBalloon(data);
        this.map.balloon.open(this.coords, data);
    }

    setBalloon(data = {}) {
        this.map.balloon.setOptions({
            //layout: 'my#baloonLayout',
            layout: this.getLayout(data),
            // contentLayout: 'my#baloonContentLayout',
            contentLayout: this.getContentLayout(data),
            offset: [0, -20]
        });
    }

    getComments(geoObject) {
        let objectState = this.clusterer.getObjectState(geoObject);

        if (objectState.isClustered) {
            let coords = JSON.stringify(geoObject.properties.get('coords'));
            let geoObjects = objectState.cluster.properties.get('geoObjects');

            return geoObjects.filter(item => JSON.stringify(item.properties.get('coords')) == coords)
                .map(item => item.properties.getAll());

        } else {
            return [geoObject.properties.getAll()];
        }
    }
}