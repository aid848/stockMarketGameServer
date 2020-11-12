import tradeRoom from "./tradeRoom";
import {Database} from "sqlite3";
const fs = require("fs");

export default class Ranks {
    public name: string;
    public sql;

    constructor(tradeRoom:tradeRoom) {
        this.name = tradeRoom.name + " ranks";
        this.sql = new Database('./db/' + this.name + '.db')
        this.sql.on("error", function (error) {
            console.log("Your error was:" + error);
        })
        // ranking database
        this.sql.run('CREATE TABLE IF NOT EXISTS ranks(' +
            'ranker TEXT,' +
            'rankee TEXT,' +
            'rank integer);');

        console.log("new ranking system created: " + this.name)
    }

    // call to make ranking
    public rank(self:Ranks,ranker:string, rankee:string, rank:number):Promise<boolean> {
        return self.checkRanked(self,ranker,rankee).then((res) => {
                if(res.ranked === true) { // new rank
                    self.sql.run("INSERT INTO ranks(ranker, rankee, rank) VALUES( \"" + ranker + "\",\"" + rankee + "\", " + rank + " );");
                }else { // already ranked
                    self.sql.run("UPDATE ranks set rank = " + rank + " WHERE ranker = \" " + ranker + "\" AND rankee = \"" + rankee + "\"")
                }
                return true;
            });
    }
    // returns if ranked and what the rank was
    public checkRanked(self:Ranks,ranker:string, rankee:string):Promise<{ ranked: boolean, rating:number }> {
        return new Promise<{ ranked: boolean, rating:number }>(((resolve, reject) => {
            self.sql.all("SELECT * FROM ranks WHERE ranker = \" " + ranker + "\" AND rankee = \"" + rankee + "\"", (err:any, rows:any) => {
                if(err !== undefined) {
                    console.log(err);
                    reject(err);
                }
                let rnk:number = 0;
                if(rows.length > 0) {
                    rnk = rows[0].rank;
                }
                let x: { ranked; rating };
                x.ranked = (rows.length > 0);
                x.rating = rnk;
                resolve(x);
            });
        }))
    }

}

