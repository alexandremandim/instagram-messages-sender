import { writeFileSync, readFileSync } from 'fs';
import {IgApiClient} from 'instagram-private-api'

export class StorageFile {
    static time_to_wait_between_requests = 4000

    static saveFile(filename: string, users_pk: Set<number>){
        writeFileSync(filename, JSON.stringify(Array.from(users_pk.values())), 'utf8')
        console.log("File saved (" + filename + ") with " + users_pk.size + " items")
    }

    static loadFromFileSync(filename: string){
        console.log('Reading directs from file...')
        const data = readFileSync(filename, {encoding:'utf8', flag:'r'})
        let users_msg_already_sent = new Set<number>(JSON.parse(data.toString()))
        console.log('Readed ' + users_msg_already_sent.size + ' user from file')

        return users_msg_already_sent
    }

    static async loadFromServer(username: string, ig: IgApiClient, users_pk: Set<number>){
        console.log('Starting getting directs from server, account: ' + username)

        var counter_already_pk = 0, flag_exit = false
        const inbox = ig.feed.directInbox()

        do{
            let all_directs = await inbox.items()
            
            for(var direct of all_directs){
                if (direct.users.length != 1) continue;
                
                let user_pk = direct.users[0].pk
                
                if(users_pk.has(user_pk)){
                    counter_already_pk++
                }else{
                    counter_already_pk = 0
                    users_pk.add(user_pk)
                }
                if(counter_already_pk >= 50){
                    console.log('Leaving because already have the remaining (50 accounts that already had)...')
                    flag_exit = true
                    break;
                }
            }
            if(flag_exit) break;
            await new Promise(r => setTimeout(r, 4000));
        }while(inbox.isMoreAvailable())

        console.log('Total users saved:' + users_pk.size )

        return users_pk
    }
}

