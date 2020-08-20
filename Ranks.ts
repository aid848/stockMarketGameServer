import tradeRoom from "./tradeRoom";
import {Database} from "sqlite3";
const fs = require("fs");

export default class Ranks {
    public name: string;
    public sql;

    constructor(tradeRoom:tradeRoom) {
        this.name = tradeRoom.name + " ranks";
        if (!fs.existsSync("db")) {
            fs.mkdirSync("db");
        }
        this.sql = new Database('./db/' + this.name + '.db')
        this.sql.on("error", function (error) {
            console.log("Your error was:" + error);
        })
        // account database
        this.sql.run('CREATE TABLE IF NOT EXISTS main.companyaccount(' +
            'name TEXT UNIQUE,' +
            'username TEXT PRIMARY KEY,' +
            'password TEXT NOT NULL,' +
            'money REAL);');

        console.log("new ranking system created: " + name)
    }
}

export function rank(self:Ranks,ranker:string, rankee:string):boolean {
    // todo perform rank operation here,

    // check table exists
    self.sql.all("SELECT * \n" +
        "FROM information_schema.tables\n" +
        "WHERE table_schema = \""+ self.name +"\" \n" +
        "    AND table_name = \""+ rankee +"\"\n" +
        "LIMIT 1;", (err: any, rows: any) => {

        if(rows>0) {
            // todo rankee is already ranked. Read from table and check if ranker is in table, if not add to table with score
        }else {
            // todo rankee not ranked, create table and add ranker to table
        }

    })

    return false;
}