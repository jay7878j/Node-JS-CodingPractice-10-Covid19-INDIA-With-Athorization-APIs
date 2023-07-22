const express = require("express");
const { open } = require("sqlite");
const sqlite = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDataBaseAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running");
    });
  } catch (error) {
    console.log(`db error : ${error.message}`);
    console.log(error);
  }
};

initializeDataBaseAndServer();

const convertToCamelCase = (data) => {
  return {
    stateId: data.state_id,
    stateName: data.state_name,
    population: data.population,
    districtId: data.district_id,
    districtName: data.district_name,
    cases: data.cases,
    cured: data.cured,
    active: data.active,
    deaths: data.deaths,
  };
};

const authenticateUser = (request, response, next) => {
  let jwtToken;

  const authenticateHeaders = request.headers["authorization"];
  if (authenticateHeaders !== undefined) {
    jwtToken = authenticateHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_TOKEN", async (error, playLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API 1 Login User
app.post("/login", async (request, response) => {
  const { username, password } = request.body;

  const getUserQuery = `SELECT * FROM user WHERE username = "${username}"`;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordCheck = await bcrypt.compare(password, dbUser.password);

    if (passwordCheck) {
      const playLoad = {
        username: username,
      };
      const jwtToken = jwt.sign(playLoad, "SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2 Get all States list from state table

app.get("/states/", authenticateUser, async (request, response) => {
  const allStatesQuery = `
    SELECT
        *
    FROM
        state
    `;
  const responseData = await db.all(allStatesQuery);
  response.send(responseData.map((each) => convertToCamelCase(each)));
});

// API 3 Get a Particular State Data from state table

app.get("/states/:stateId/", authenticateUser, async (request, response) => {
  const { stateId } = request.params;
  const singleStateQuery = `
    SELECT
        *
    FROM
        state
    WHERE
        state_id = ${stateId}
    `;
  const responseData = await db.get(singleStateQuery);
  response.send(convertToCamelCase(responseData));
});

// API 4 Create a New district data into District Table

app.post("/districts/", authenticateUser, async (request, response) => {
  const districtData = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = districtData;

  const createDistrictQuery = `
    INSERT INTO
        district (district_name,state_id,cases, cured, active, deaths)
    VALUES
        ("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})
    `;

  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// API 5 Get A Particular District Data from District Table

app.get(
  "/districts/:districtId/",
  authenticateUser,
  async (request, response) => {
    const { districtId } = request.params;
    const singleDistrictQuery = `
    SELECT
        *
    FROM
        district
    WHERE
        district_id = ${districtId}
    `;
    const responseData = await db.get(singleDistrictQuery);
    response.send(convertToCamelCase(responseData));
  }
);

// API 6 Delete a Particular District Data from District Table

app.delete(
  "/districts/:districtId/",
  authenticateUser,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
        district
    WHERE
        district_id = ${districtId}
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API 7 Update a Particular District Data

app.put(
  "/districts/:districtId/",
  authenticateUser,
  async (request, response) => {
    const { districtId } = request.params;
    const updateDistrictData = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = updateDistrictData;

    const updateDistrictDataQuery = `
    UPDATE
        district
    SET
        district_name = "${districtName}",
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE
        district_id = ${districtId};
    `;
    await db.run(updateDistrictDataQuery);
    response.send("District Details Updated");
  }
);

// API 8 Get statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  "/states/:stateId/stats/",
  authenticateUser,
  async (request, response) => {
    const { stateId } = request.params;

    const getStatisticsQuery = `
    SELECT
        sum(cases) as totalCases,
        sum(cured) as totalCured,
        sum(active) as totalActive,
        sum(deaths) as totalDeaths
    FROM
        district
    WHERE
        state_id = ${stateId};
    `;
    const responseData = await db.get(getStatisticsQuery);
    response.send(responseData);
  }
);

module.exports = app;
