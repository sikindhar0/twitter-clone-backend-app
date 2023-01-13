const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//user register
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const userQuery = `
    select * from user where username = '${username}';`;
  const user = await database.get(userQuery);
  if (user !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const query = `
        insert into user (username,password,name,gender)
        values ('${username}','${hashedPassword}','${name}','${gender}');`;
      const dbResponse = await database.run(query);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

// user login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `
    select * from user where username = '${username}';`;
  const user = await database.get(checkUserQuery);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (isPasswordCorrect) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "mysecretkey");
      response.send({
        jwtToken,
      });
      console.log(jwtToken);
      console.log(payload);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//authentication Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "mysecretkey", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//api 3  latest tweets of people ( 4 tweets)
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const user = request.username;
  const tweetsQuery = `
    select * from tweet 
    inner join user on 
    tweet.user_id = user.user_id
    where tweet.user_id in 
    (select following_user_id
    from follower 
    where follower_user_id = 
    (select user_id from user 
    where username='${user}'))
    order by date_time desc
    limit 4;`;
  const data = await database.all(tweetsQuery);
  response.send(
    data.map((e) => {
      return {
        username: e.username,
        tweet: e.tweet,
        dateTime: e.date_time,
      };
    })
  );
});

//followings of a user
app.get("/user/following/", authenticateToken, async (request, response) => {
  const user = request.username;
  const query = `
    select * from follower 
    inner join user on user.user_id = follower.following_user_id
     where follower_user_id = (
        select user_id from user
         where username='${user}' 
    );`;
  const data = await database.all(query);
  response.send(
    data.map((e) => {
      return {
        name: e.name,
      };
    })
  );
});

//followers of a user
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const user = request.username;
  const query = `
    select * from follower 
    inner join user on user.user_id = follower.follower_user_id
     where following_user_id = (
        select user_id from 
        user where username='${user}' 
    );`;
  const data = await database.all(query);
  response.send(
    data.map((e) => {
      return {
        name: e.name,
      };
    })
  );
});

//get tweets by tweet id

module.exports = app;
