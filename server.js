const express = require('express')
let app = express()
const { pool } = require('./db_config')
const bcrypt = require('bcrypt')
const session = require('express-session')
const flash = require('express-flash')
const passport = require('passport')
const initializePassport = require('./passport_config')
const Storage = require('node-localstorage')
const { query } = require('express')
const cron = require('node-cron')
const fs = require('fs')
const fast_csv = require('fast-csv')

app.use('/public', express.static(__dirname + '/public'))

//This schedular is running everyday at 11 : 58 PM
cron.schedule('59 58 23 * * *', () => {
    console.log('This schedular is running everyday at 11 : 58 PM')
    let date = new Date().getDate()
    let month = new Date().getMonth()
    let year = new Date().getFullYear()

    let today = `${date}-${month}-${year}`
    let data = null
    let name = `data_${today}.csv`
    pool.query(`SELECT * FROM orders_list WHERE orders_date = '${today}'`,
        (err, result) => {
            if (err)
                throw err
            data = result.rows
            let ws = fs.createWriteStream(`public/${name}`)
            fast_csv
                .write(data, { headers: true })
                .on('finish', () => {
                    console.log('Exported data!')
                })
                .pipe(ws)

        })

})

initializePassport(passport);

if (typeof localStorage === "undefined" || localStorage === null) {
    var LocalStorage = Storage.LocalStorage;
    localStorage = new LocalStorage('./scratch');
}

let PORT = process.env.PORT || 3000

app.set('view engine', 'ejs');

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

app.get('/', (req, res) => {
    res.render('index')
})

app.get('/users/register', checkAuthenticated, (req, res) => {
    res.render('register')
})
app.get('/users/login', checkAuthenticated, (req, res) => {
    res.render('login')
})
app.get('/users/cart', checkNotAuthenticated, (req, res) => {
    let user_id = localStorage.getItem('ID')
    pool.query(`SELECT * from carts WHERE user_id = ${user_id}`,
        (err, result) => {
            if (err)
                throw err
            else {
                console.log(result.rows)
                rowCount = result.rowCount
                cart = result.rows
                total = 0
                result.rows.forEach(element => {
                    total = total + element.total_price
                });
                res.render('cart')
            }
        })
})
app.get('/users/product/:cart_id', checkNotAuthenticated, (req, res) => {
    let { cart_id } = req.params
    pool.query(`DELETE from carts WHERE id = ${cart_id}`,
        (err, result) => {
            if (err)
                throw err
            else
                res.redirect('/users/cart')
        })

    console.log('cart_id ', cart_id)
})
app.get('/user/clear_cart', checkNotAuthenticated, (req, res) => {
    let user_id = localStorage.getItem('ID')
    pool.query(`DELETE from carts WHERE user_id = ${user_id}`,
        (err, result) => {
            if (err)
                throw err
            else
                res.redirect('/users/cart')
        })
})

app.post('/users/addToCarts/:product_id/:product_name/:product_price', checkNotAuthenticated, (req, res) => {
    let { product_id, product_name, product_price } = req.params
    let qty = req.body.qty
    let user_id = localStorage.getItem('ID')
    let total_price = product_price * qty

    console.log('Product', { product_id, product_name, product_price, qty, user_id, total_price })
    pool.query(`INSERT INTO carts (product_price, qty, user_id, total_price, product_id, product_name) 
                VALUES ($1, $2, $3, $4, $5, $6 ) RETURNING id`,
        [product_price, qty, user_id, total_price, product_id, product_name],
        (err, result) => {
            if (err)
                throw err;
            console.log(result.rows)
        })

    res.redirect('/users/products')
})
app.get('/users/buy/:price', checkNotAuthenticated, (req, res) => {
    price = req.params.price
    res.render('buy_now')
})
app.get('/users/make_payment/:price', checkNotAuthenticated, (req, res) => {
    price = req.params.price
    let user_id = localStorage.getItem('ID')
    let date = new Date().getDate()
    let month = new Date().getMonth()
    let year = new Date().getFullYear()

    let today = `${date}-${month}-${year}`
    console.log(today)

    pool.query(`DELETE from carts WHERE user_id = ${user_id}`,
        (err, result) => {
            if (err)
                throw err
        })

    pool.query(`INSERT INTO orders_list (price, user_id, orders_date)
                    VALUES ($1, $2, $3) RETURNING id`, [price, user_id, today],
        (err, result) => {
            if (err)
                throw err;
            else {
                res.render('products')
            }

        })
})
app.get('/users/products', checkNotAuthenticated, (req, res) => {
    pool.query(`SELECT * from products`,
        (err, result) => {
            if (err)
                throw err
            else {
                console.log(result.rows)
                products = result.rows
                res.render('products')
            }
        })

    //res.send(products)
})
app.get('/users/logout', (req, res) => {
    req.logOut()
    req.flash('success_messgae', 'You have logged out!')
    res.redirect('/users/login')
})


app.post('/users/register', async (req, res) => {
    console.log(req.body)
    let { name, email, password } = req.body;
    let hasPass = await bcrypt.hash(password, 10)
    let errors = []

    pool.query(`SELECT * FROM user_list WHERE email = $1`, [email],
        (err, result) => {
            if (err)
                throw err;
            else {
                if (result.rowCount) {
                    errors.push('Email is already registerd!')
                }
                else {
                    pool.query(`INSERT INTO user_list (name, email, password)
                    VALUES ($1, $2, $3) RETURNING id, password`, [name, email, hasPass],
                        (err, result) => {
                            if (err)
                                throw err;
                            console.log(result.rows)
                            req.flash('success_msg', 'You have registerd.. Please login!')
                            res.redirect('/users/login')
                        })
                }
            }
        })

})

app.post('/users/login', passport.authenticate('local', {
    successRedirect: '/users/products',
    failureRedirect: '/users/login',
    failureFlash: true,

})
)

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated())
        return res.redirect('/users/products')
    next()
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated())
        return next()
    res.redirect('/users/login')
}

app.listen(PORT, () => {
    console.log(`Server is listning on port ${PORT}`)
})

