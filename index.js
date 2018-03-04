const needle = require('needle');
const cheerio = require('cheerio');
const fs = require('fs');
const readline = require('readline-promise');
const clear = require('console-clear');

const rlp = readline.default.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

const baseUrl ='https://www.drive2.ru';
const URL_BRANDS = 'https://www.drive2.ru/cars';
const expCarUrl = /(<a class="c-car-title c-link c-link--text" href=")([\s\S]*?)(<\/a>)/gi;
const expPrice = /(<div class="u-rouble c-car-forsale__price">)([\s\S]*?)(<strong>)([\s\S]*?)(<\/strong>)([\s\S]*?)(<\/div>)/;
const expCity = /(<h3 class="c-header c-car-forsale__title">)([\s\S]*?)(<\/h3>)/;

const getCars = (url) => {
    
    return needle('get', url)
        .then((res) => {     
            const {html,start} = JSON.parse(res.body);
            if (start === undefined) {
                // console.log('ВСЁ');
                return false;
            };
            
            var match;
            const cars = [];
            while (match = expCarUrl.exec(html)) {
                const [href, name] = match[2].split('>');
                const obj = {href: baseUrl+href.trim().slice(0, -1), name}

                cars.push(obj);
            }
            return Promise.all(cars.map(({href}) => 
                needle('get', href)
                    .then(({body}) => {
                        const r = /class="c-car-forsale"/.test(body);
                        if (r){
                            const price = expPrice.exec(body)[4];
                            const city = expCity.exec(body)[2].trim();
                            console.log(city, price);
                            return `\n${city} - ${price} ${href}`;
                        }
                        return undefined
                    })
            ))
                .then((cars) => {
                    return ({
                        cars:cars.filter((r) => r),
                        start
                    });
                })
            
        })
        .catch((error) => {throw error})
}

const getType = (url, type = undefined) => {
    return needle('get', url)
        .then((res) => {
            const $ = cheerio.load(res.body);
            const types = [];
            $('a[class=c-link]').each(function() {
                const obj = {
                    href: baseUrl+this.attribs.href,
                    name: this.children[0].data
                };
                types.push(obj);
            });
            if (type && types[type]) {
                console.log(types[type].name);
                return types[type].href
            }
            return choice(types);
        })
        .catch((error) => {throw error})
}

async function choice(types,index = 0){
    clear();
    types.slice(index, index+19).forEach((brand, i) =>{
        console.log(`${index+i} ${brand.name}`)
    })
    console.log('+ смотреть далее');
    let answer;
    answer = await rlp.questionAsync('Номер бичуган?')
    if (answer === '+') return choice(types, index + 19)
    return types[answer].href;

};

const getModelFromURL = (url) => {
    const arr = url.split('/');
    const model = arr[arr.length-2];
    return (`${model[0]}_${model.slice(1)}`);
}

async function getSellCars(model) {
    console.log('ПОИСК');
    let start = 0;
    let index = -1;
    let cars = [];
    let findCars;

    while(findCars = await getCars(
        `https://www.drive2.ru/ajax/carsearch.cshtml?context=${model}&start=${start}&sort=Drive&index=${index}&country=RU&city=2191`
    )) //&city=2191
    {
        cars = cars.concat(findCars.cars);
        start = findCars.start;
        index++    
        // console.log('Проверенно машин :', start)    
    }
    return cars
}

function run() {
    const [,,brand,mogel,generation] = process.argv;
    // const [brand,mogel,generation] = [18,26,5]; //39
    return getType(URL_BRANDS, brand)
        .then((brandURL) => getType(brandURL, mogel))
        .then((modelURL) => getType(modelURL, generation))        
        .then((generationURL) => getSellCars(getModelFromURL(generationURL)))
        .then((cars) => {
            console.log('Найденно машин: ', cars.length);
            console.log('ВЫХОД')
            fs.writeFileSync("cars.txt", cars)
            process.exit(-1);
        })
}

run();