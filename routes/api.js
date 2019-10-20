/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
const https = require('https');
const key = process.env.ALPHA_VANTAGE; // https://www.alphavantage.co/documentation/

const MongoClient = require("mongodb").MongoClient,
      ObjectId = require('mongodb').ObjectID,
      mongoUri = process.env.MONGO_URI,
      flagObj = {
        useNewUrlParser: true,
        useUnifiedTopology: true
      },
      database = "cluster0-dknbk"
;

const testInput = input => {
  if (!(/^[a-z]+$/i.test(input))) return false;
  return true;
};

const getPrice = (symbol, key = process.env.ALPHA_VANTAGE) => {
  return new Promise(waitForPrice => {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&outputsize=compact&apikey=${key}`;
    https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        const stockResponse = JSON.parse(body);
        let price;
        if (stockResponse["Error Message"]) {
          price = "Invalid stock name or the given stock is not supported.";
        } else if (stockResponse["Note"] && key === process.env.ALPHA_VANTAGE2) {
          price = "Sorry, this API call frequency is 5 calls per minute and 500 calls per day.";
        } else if (stockResponse["Note"] && key === process.env.ALPHA_VANTAGE) {
          // console.log("second key used");
          getPrice(symbol, process.env.ALPHA_VANTAGE2);
        } else {
          const lastRefreshed = stockResponse["Meta Data"]["3. Last Refreshed"];
          price = + stockResponse["Time Series (1min)"][lastRefreshed]["4. close"]; 
        }
        waitForPrice(price);
      });
    }).on("error", (e) => {
      console.log("Got an error: ", e);
    });
  });
};

const getLikes = (symbol) => {
  return new Promise(waitForLikes => {
    MongoClient.connect(mongoUri, flagObj, (error, db) => {
      if (error) throw error;
      const dbo = db.db(database);
      dbo.collection("stocks").findOne({_id: symbol}, (error, result) => {
        if (error) throw error;
        let likes = 0;
        if (result) {
          likes = result.likes;
        }
        waitForLikes(likes);
      });
    });
  });
};

const getIp = req => {
  if (req.headers['x-forwarded-for']) return req.headers['x-forwarded-for'].split(",")[0];
  if (req.connection.remoteAddress)  return req.connection.remoteAddress;
  if (req.socket.remoteAddress) return req.socket.remoteAddress;
  if (req.connection.socket.remoteAddress) return req.connection.socket.remoteAddress.split(",")[0];
};

// check if this address still not exists:
const checkIp = (likes, stockdata, symbol, ipAddress) => {
  if (likes === 0) {
    stockdata.stockdata.likes ++;
    // insert new stock and ip to the database:
    MongoClient.connect(mongoUri, flagObj, (error, db) => {
      if (error) throw error;
      const dbo = db.db(database);
      dbo.collection("stocks").insertOne({_id: symbol, likes: [ipAddress]}, (error, result) => {
        if (error) throw error;
        db.close();
      });
    });
  } else if (!(likes.includes(ipAddress))) {
    stockdata.stockdata.likes ++;
    storeIp(symbol, ipAddress);
  }
};

const storeIp = (select, ip) => {
  MongoClient.connect(mongoUri, flagObj, (error, db) => {
    if (error) throw error;
    const dbo = db.db(database);
    const selected = {_id: select};
    const newValues = {
      $push: {
        likes: ip
      }
    };
    dbo.collection("stocks").updateOne(selected, newValues, (error, result) => {
      if (error) throw error;
      db.close();
    });
  });
};

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get((req, response) => {
      if (typeof req.query.stock === "string") {
        // Get single price and total likes:
        if (!(testInput(req.query.stock))) return response.send({error: "Invalid user input."});
        const symbol = req.query.stock.toUpperCase();
        const price = getPrice(symbol);
        const likes = getLikes(symbol);
        Promise.all([price, likes]).then(values => {
          const price = values[0];
          const likes = values[1];
          if (typeof price === "string") {
            return response.send({error: price});
          } else {
            const stockdata = {
              stockdata: {
                stock: symbol,
                price: price,
                likes: + likes.length || 0
              }
            };
            // check the like checkbox
            if (req.query.like) {
              const ipAddress = getIp(req);
              if (ipAddress) {
                // check if this address still not exists:
                checkIp(likes, stockdata, symbol, ipAddress);
              };
            }
            response.send(stockdata);
          }
        });
      } else if (typeof req.query.stock === "object") {
        // Compare and get relative likes:
        if (!(testInput(req.query.stock[0])) || !(testInput(req.query.stock[1]))) return response.send({error: "Invalid user input."});
        const symbol1 = req.query.stock[0].toUpperCase();
        const symbol2 = req.query.stock[1].toUpperCase();
        const price1 = getPrice(symbol1);
        const price2 = getPrice(symbol2);
        const likes1 = getLikes(symbol1);
        const likes2 = getLikes(symbol2 );
        Promise.all([price1, likes1, price2, likes2]).then(values => {
          const price1 = values[0];
          const likes1 = values[1];
          const price2 = values[2];
          const likes2 = values[3];
          if (typeof price1 === "string") {
            return response.send({error: price1});
          } else if (typeof price2 === "string" ) {
            return response.send({error: price2});
          } else {
            const stockdata = {
              stockdata: [
                {
                  stock: symbol1,
                  price: price1,
                  rel_likes: (+ likes1.length || 0) - (+ likes2.length || 0)
                },
                {
                  stock: symbol2,
                  price: price2,
                  rel_likes: (+ likes2.length || 0) - (+ likes1.length || 0)
                }
              ]
            };
            // check the like checkbox
            if (req.query.like) {
              const ipAddress = getIp(req);
              if (ipAddress) {
                // check if these address still not exists:
                checkIp(likes1, stockdata, symbol1, ipAddress);
                checkIp(likes2, stockdata, symbol2, ipAddress);
              };
            }
            response.send(stockdata);
          }
        });
      } else response.send("Invalid user input.");
    });  
};
