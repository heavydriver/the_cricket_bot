require("dotenv").config();
const puppeteer = require("puppeteer");
const moment = require("moment-timezone");
const Twitter = require("twitter");

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

moment.tz.setDefault("Asia/Kolkata");

async function scrapeFixture(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);

  const fixture = await page.$eval(
    "#scheulediv > div:nth-child(1)",
    (el) => el.innerHTML
  );

  let fixtures = [];

  const numOfMatches = fixture.split("sp-scr_wrp").length - 1;

  for (let i = 1; i <= numOfMatches; i++) {
    fixtures.push({
      date: new Date(),
      match: {
        id: i,
        title: await page.evaluate((element) => {
          return element.textContent;
        }, (await page.$x(`/html/body/div[2]/div[3]/div/div/div/div[1]/article/div/div/div/div/div[3]/div/div[2]/div[1]/div[${i}]/span[2]`))[0]),
        startsAt: await page.evaluate((element) => {
          return element.textContent;
        }, (await page.$x(`/html/body/div[2]/div[3]/div/div/div/div[1]/article/div/div/div/div/div[3]/div/div[2]/div[1]/div[${i}]/span[3]`))[0]),
        location: await page.evaluate((element) => {
          return element.textContent.split(", ")[1];
        }, (await page.$x(`/html/body/div[2]/div[3]/div/div/div/div[1]/article/div/div/div/div/div[3]/div/div[2]/div[1]/div[${i}]/span[5]`))[0]),
      },
    });
  }

  let message = "#MatchesToday:\n";

  fixtures.forEach((game) => {
    message = message.concat(
      ...`\n${game?.match?.title}\nStarts at ${moment
        .utc(game?.match?.startsAt)
        .parseZone()
        .format("hh:mm A")} IST (${moment
        .utc(game?.match?.startsAt)
        .format("hh:mm A")} GMT)\nAt ${game?.match?.location}\n`
    );
  });

  message = message.concat(..."\n#cricket");

  const params = {
    status: message,
  };

  client
    .post("statuses/update", params)
    .then(function (tweet) {
      console.log(tweet);
    })
    .catch(function (error) {
      console.log(error);
    });

  await browser.close();
}

async function scrapeResults(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(url);

  const fixture = await page.$eval(
    "#scheulediv > div:nth-child(3)",
    (el) => el.innerHTML
  );

  let fixtures = [];

  const numOfMatches = fixture.split("sp-scr_wrp").length - 1;

  async function screenshot(fixture) {
    if (fixture?.match?.title.indexOf("Under-19") === -1) {
      await page.goto(
        `https://www.google.com/search?q=${fixture?.match?.title}`
      );
      await page.waitForSelector(
        "#sports-app > div > div.imso-hov.imso-mh > div > div > div > div"
      );
      await page.click(
        "#sports-app > div > div.imso-hov.imso-mh > div > div > div > div"
      );
      await page.waitForTimeout(5000);
      const scoreBoard = await page.$(
        "#liveresults-sports-immersive__match-fullpage > div > div > div.nGzje > div.imso-hide-loading.imso-mh > div > div > div > div > div.imso_mh__tm-scr.imso_mh__mh-bd"
      );
      await scoreBoard.screenshot({
        path: `${fixture?.match?.title}_1.png`,
        type: "png",
      });
      const summary = await page.$(
        "#liveresults-sports-immersive__match-fullpage > div > div > div.nGzje > div:nth-child(3) > div"
      );
      await summary.screenshot({
        path: `${fixture?.match?.title}_2.png`,
        type: "png",
      });
    }
  }

  for (let i = 1; i <= numOfMatches; i++) {
    fixtures.push({
      date: new Date(),
      match: {
        id: i,
        title: await page.evaluate((element) => {
          return element.textContent;
        }, (await page.$x(`/html/body/div[2]/div[3]/div/div/div/div[1]/article/div/div/div/div/div[3]/div[1]/div[2]/div[${i}]/span[2]`))[0]),
        result: await page.evaluate((element) => {
          return element.textContent;
        }, (await page.$x(`/html/body/div[2]/div[3]/div/div/div/div[1]/article/div/div/div/div/div[3]/div[1]/div[2]/div[${i}]/a/div[6]/div`))[0]),
        img1: `${await page.evaluate((element) => {
          return element.textContent;
        }, (await page.$x(`/html/body/div[2]/div[3]/div/div/div/div[1]/article/div/div/div/div/div[3]/div[1]/div[2]/div[${i}]/span[2]`))[0])}_1.png`,
        img2: `${await page.evaluate((element) => {
          return element.textContent;
        }, (await page.$x(`/html/body/div[2]/div[3]/div/div/div/div[1]/article/div/div/div/div/div[3]/div[1]/div[2]/div[${i}]/span[2]`))[0])}_2.png`,
      },
    });
  }

  function delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  let imgUpload = true;

  fixtures.forEach((fixture) => {
    screenshot(fixture);
  });

  fixtures.map((fixture) => {
    let message = `Match: ${fixture?.match?.title}\nResult: ${fixture?.match?.result}\n\n#cricket`;
    let img1;

    try {
      img1 = require("fs").readFileSync(`${fixture?.match?.title}_2.png`);
    } catch (error) {
      imgUpload = false;
    }

    delay(5000);
    if (imgUpload) {
      client.post(
        "media/upload",
        { media: img1 },
        function (error, media, response) {
          if (!error) {
            console.log(media);

            var status = {
              status: message,
              media_ids: media.media_id_string,
            };

            client.post(
              "statuses/update",
              status,
              function (error, tweet, response) {
                if (!error) {
                  console.log(tweet);
                }
              }
            );
          }
        }
      );
      delay(5000);
    } else {
      const params = {
        status: message,
      };

      client
        .post("statuses/update", params)
        .then(function (tweet) {
          console.log(tweet);
        })
        .catch(function (error) {
          console.log(error);
        });
    }
  });

  await browser.close();
}

scrapeResults("https://sports.ndtv.com/cricket/results");
scrapeFixture("https://sports.ndtv.com/cricket/schedules-fixtures");
