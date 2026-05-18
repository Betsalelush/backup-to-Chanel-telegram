import asyncio
import random
from telethon import TelegramClient, errors
from colorama import Fore, Style
import re

# פרטי החשבונות
accounts = [
    {"api_id": 0000, "api_hash": "00000", "phone_number": "972501234567", "client_name": "account1"},

{"api_id": 0000, "api_hash": "00000", "phone_number": "972501234567", "client_name": "account2"},

{"api_id": 0000, "api_hash": "00000", "phone_number": "972501234567", "client_name": "account3"},

]
#איידי מקור הגיבוי
source_chat_id = -10099999999

#איידי יעד הקבצים
target_chat_id = -1009999999

def save_last_processed_message_id(message_id):
    with open("last_id.txt", "w") as f:
        f.write(str(message_id))

def load_last_processed_message_id():
    try:
        with open("last_id.txt", "r") as f:
            return int(f.read().strip())
    except FileNotFoundError:
        return 0

async def send_media(source, target, clients):
    current_idx = 0
    
    while True:
        client = clients[current_idx]
        last_id = load_last_processed_message_id()
        
        try:
            messages_in_batch = 0
            last_processed_in_loop = last_id
            
            # מושכים הודעות חדשות מהמקור
            async for message in client.iter_messages(source, offset_id=last_id, reverse=True, limit=50):
                
                # עדכן תמיד את ה-ID האחרון שעברנו עליו, גם אם אין מדיה
                if message.id > last_processed_in_loop:
                    last_processed_in_loop = message.id
                
                # בדיקה שיש מדיה (סרטון או קובץ) - אבל לא סטיקר או תמונה
                if (message.video or message.document) and not (message.sticker or message.photo):
                    try:
                        # ניקוי קישורים מהטקסט
                        clean_caption = re.sub(r'https?://\S+|www\.\S+|t\.me/\S+|@\S+', '', message.text or "").strip()

                        await client.send_message(
                            target, 
                            clean_caption, 
                            file=message.media
                        )
                        
                        print(f"{Fore.GREEN}Account {current_idx+1} copied msg {message.id} (No Credit){Style.RESET_ALL}")
                        
                        messages_in_batch += 1
                        
                        # השהייה אקראית למניעת זיהוי
                        await asyncio.sleep(random.uniform(1.4, 3.8))
                        
                        max_batch = random.randint(2, 6)
                        if messages_in_batch >= max_batch:
                            # שמור את ה-ID האחרון שע�דנו ויצא מהלולאה
                            save_last_processed_message_id(last_processed_in_loop)
                            break

                    except errors.FloodWaitError as e:
                        print(f"{Fore.RED}FloodWait: {e.seconds}s. Switching account...{Style.RESET_ALL}")
                        # שמור את ההתקדמות לפני החלפת חשבון
                        save_last_processed_message_id(last_processed_in_loop)
                        await asyncio.sleep(2.8)
                        break 
                    
                    except Exception as e:
                        print(f"{Fore.RED}Error sending message {message.id}: {e}{Style.RESET_ALL}")
                        continue
                else:
                    # הודעה ללא מדיה - רק עדכן התקדמות
                    print(f"{Fore.YELLOW}Account {current_idx+1}: Skipping msg {message.id} (no media){Style.RESET_ALL}")
                    # המשך להודעה הבאה בלי לשלוח
            
            # שמור את ההתקדמות בסוף הלולאה (גם אם לא שלחנו כלום)
            if last_processed_in_loop > last_id:
                save_last_processed_message_id(last_processed_in_loop)
                print(f"{Fore.CYAN}Progress saved: up to message {last_processed_in_loop}{Style.RESET_ALL}")

            # החלפת חשבון
            current_idx = (current_idx + 1) % len(clients)
            print(f"{Fore.CYAN}Switching to account {current_idx + 1}...{Style.RESET_ALL}")
            await asyncio.sleep(random.uniform(2, 6))

        except Exception as e:
            print(f"{Fore.RED}General Error: {e}{Style.RESET_ALL}")
            await asyncio.sleep(30)

async def main():
    clients = []
    for acc in accounts:
        client = TelegramClient(acc["client_name"], acc["api_id"], acc["api_hash"])
        await client.start(phone=acc["phone_number"])
        clients.append(client)
        print(f"{Fore.GREEN}{acc['client_name']} connected successfully{Style.RESET_ALL}")
    
    print(f"{Fore.CYAN}System active - Copying messages without forward credit.{Style.RESET_ALL}")
    await send_media(source_chat_id, target_chat_id, clients)

if __name__ == "__main__":
    asyncio.run(main())
