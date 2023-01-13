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
// app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
//   const user = request.username;
//   const { tweetId } = request.params;
//   const getUserIdQuery = `select user_id from user where username='${user}';`;
//   const userId = await database.get(getUserIdQuery);

//   const userFollowingQuery = `
//   select following_user_id from follower
//   where
//      follower_user_id = ${userId.user_id};`;
//   const userFollowing = await database.all(userFollowingQuery);
//   const userFollowingArr = userFollowing.map((e) => {
//     return e.following_user_id;
//   });

//   const getTweetIdsQuery = ` select tweet_id from tweet where user_id in (${userFollowingArr});`;
//   const tweets = await database.all(getTweetIdsQuery);
//   const tweetIdsArr = tweets.map((e) => {
//     return e.tweet_id;
//   });
//   console.log(tweetIdsArr);
//   if (tweetIdsArr.includes(parseInt(tweetId))) {
//     const tweetQuery = `select tweet from tweet where tweet_id = ${tweetId};`;
//     const tweet = await database.get(tweetQuery);
//     console.log(tweet);

//     const likesCountQuery = `
//       select count(like_id) as likes from like where tweet_id = ${tweetId} group by tweet_id;`;
//     const likesCount = await database.get(likesCountQuery);
//     console.log(likesCount);

//     const repliesCountQuery = `
//       select count(reply_id) as replies from reply where tweet_id = ${tweetId} group by tweet_id;`;
//     const repliesCount = await database.get(repliesCountQuery);
//     console.log(repliesCount);

//     const dateQuery = `
//       select date_time as dateTime from tweet where tweet_id = ${tweetId};`;
//     const date = await database.get(dateQuery);
//     console.log(date);
//     response.status(200);
//     response.send({
//       tweet: tweet.tweet,
//       likes: likesCount.likes,
//       replies: repliesCount.replies,
//       dataTime: date.dateTime,
//     });
//   } else {
//     response.status(401);
//     response.send("Invalid Request");
//   }
// });

// middleware function for checking the valid followers
const checkFollowing = async (request, response, next) => {
  const { tweetId } = request.params;

  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);
  //get the ids of whom the use is following
  const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
  const getFollowingIdsArray = await database.all(getFollowingIdsQuery);

  const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
    return eachFollower.following_user_id;
  });

  const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
  const getTweetIdsArray = await database.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });
  if (followingTweetIds.includes(parseInt(tweetId))) {
    next();
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
};

// api 6  get tweets by tweet id
app.get(
  "/tweets/:tweetId/",
  authenticateToken,
  checkFollowing,
  async (request, response) => {
    const { tweetId } = request.params;

    const likes_count_query = `select count(user_id) as likes from like where tweet_id=${tweetId};`;
    const likes_count = await database.get(likes_count_query);

    const reply_count_query = `select count(user_id) as replies from reply where tweet_id=${tweetId};`;
    const reply_count = await database.get(reply_count_query);

    const tweetDateQuery = `select tweet, date_time from tweet where tweet_id=${tweetId};`;
    const tweetData = await database.get(tweetDateQuery);

    response.send({
      tweet: tweetData.tweet,
      likes: likes_count.likes,
      replies: reply_count.replies,
      dateTime: tweetData.date_time,
    });
  }
);

//api 7
app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  checkFollowing,
  async (request, response) => {
    const { tweetId } = request.params;
    const getLikesQuery = `
    select username from user 
    where user_id in 
    (select user_id from like
         where tweet_id = ${tweetId});`;
    const likesData = await database.all(getLikesQuery);
    const likesUsers = likesData.map((e) => {
      return e.username;
    });
    response.send({ likes: likesUsers });
  }
);

//api 8
app.get(
  "/tweets/:tweetId/replies",
  authenticateToken,
  checkFollowing,
  async (request, response) => {
    const { tweetId } = request.params;
    const getReplyQuery = `
    select user.name as name,reply.reply as reply from reply inner join user on user.user_id = reply.user_id
         where tweet_id = ${tweetId};`;
    const replyData = await database.all(getReplyQuery);
    // const likesUsers = likesData.map((e) => {
    //   return e.username;
    // });
    response.send({ replies: replyData });
  }
);

//api9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const user = request.username;
  const getReplyQuery = `
    select tweet, count(like_id),count(reply_id) from
    (select * from tweet inner join like on tweet.tweet_id = like.tweet_id) as t inner join
    reply on reply.tweet_id = t.tweet_id
    group by t.tweet_id
         ;`;
  const replyData = await database.all(getReplyQuery);
  // const likesUsers = likesData.map((e) => {
  //   return e.username;
  // });
  response.send(replyData);
});

//api 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);
  //console.log(getUserId.user_id);
  const { tweet } = request.body;
  //console.log(tweet);

  //   const currentDate = new Date();
  //   console.log(currentDate.toISOString().replace("T", " "));
  const currentDate = format(new Date(), "yyyy-M-d HH-mm-ss");

  const postRequestQuery = `insert into tweet(tweet, user_id, date_time) values ("${tweet}", ${getUserId.user_id}, '${currentDate}');`;

  const responseResult = await database.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});

/*
//to check if the tweet got updated
app.get("/tweets/", authenticationToken, async (request, response) => {
  const requestQuery = `select * from tweet;`;
  const responseResult = await database.all(requestQuery);
  response.send(responseResult);
});*/

//deleting the tweet

//api 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    //console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await database.get(getUserIdQuery);
    //console.log(getUserId.user_id);
    //tweets made by the user
    const getUserTweetsListQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
    const getUserTweetsListArray = await database.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getUserTweetsList);
    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId};`;
      await database.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
