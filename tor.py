import asyncio
import json
import random
import time
import os
from typing import List, Dict, Optional, Set
from telethon import TelegramClient, errors
from telethon.sessions import StringSession
from telethon.tl.types import InputPeerChannel, InputPeerChat, MessageMediaPhoto, MessageMediaDocument, Channel, Chat, Message
import socks
from datetime import datetime, timedelta
import logging

# הגדרת לוגים
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# קבועים
SESSIONS_FILE = 'sessions.json'
PROGRESS_FILE = 'progress.json'

class TelegramSender:
    def __init__(self):
        self.clients: List[TelegramClient] = []
        self.sent_message_ids: Set[int] = set()
        self.last_processed_message_id: int = 0
        self.consecutive_successes: int = 0
        self.client_flood_wait_until: Dict[int, datetime] = {} # {auth_key_id: datetime_until}

        self.השהיה_בין_הודעות = 2
        self.מקס_הודעות_לדקה = 20
        self.מונה_הודעות_בדקה = 0
        self.זמן_תחילת_דקה = datetime.now()

    def load_progress(self) -> Dict:
        """טעינת נתוני התקדמות מקובץ"""
        if os.path.exists(PROGRESS_FILE):
            try:
                with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                    progress = json.load(f)
                self.sent_message_ids = set(progress.get('sent_message_ids', []))
                self.last_processed_message_id = progress.get('last_message_id', 0) # שונה ל-last_message_id
                logger.info(f"✅ נטענה התקדמות קודמת: {len(self.sent_message_ids)} הודעות סומנו כנשלחו, מזהה ההודעה האחרונה שעיבדנו הוא {self.last_processed_message_id}")
                return progress
            except Exception as e:
                logger.error(f"שגיאה בטעינת התקדמות: {e}. מאפס התקדמות.")
        self.sent_message_ids = set()
        self.last_processed_message_id = 0
        return {'sent_message_ids': [], 'last_message_id': 0} # שונה ל-last_message_id

    def save_progress(self):
        """שמירת נתוני התקדמות לקובץ"""
        try:
            # גיזום sent_message_ids אם גדול מדי, ללא מיון לא יעיל
            if len(self.sent_message_ids) > 100000: # שומר רק 100,000 הודעות אחרונות ב-set
                temp_list = list(self.sent_message_ids)
                random.shuffle(temp_list) # ערבוב כדי לקבל דגימה אקראית
                self.sent_message_ids = set(temp_list[:100000])
            
            progress_data = {
                'sent_message_ids': list(self.sent_message_ids),
                'last_message_id': self.last_processed_message_id # שונה ל-last_message_id
            }
            with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
                json.dump(progress_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ שגיאה בשמירת התקדמות: {e}")

    async def בדוק_הגבלות(self):
        """בודק ומנהל את הגבלות קצב השליחה כדי למנוע חסימה."""
        זמן_שעבר = datetime.now() - self.זמן_תחילת_דקה

        if זמן_שעבר.total_seconds() >= 60:
            self.מונה_הודעות_בדקה = 0
            self.זמן_תחילת_דקה = datetime.now()

        if self.מונה_הודעות_בדקה >= self.מקס_הודעות_לדקה:
            המתנה = 60 - זמן_שעבר.total_seconds()
            if המתנה > 0:
                logger.warning(f"הגעת להגבלת הקצב. ממתין {int(המתנה)} שניות...")
                await asyncio.sleep(המתנה)
            self.מונה_הודעות_בדקה = 0
            self.זמן_תחילת_דקה = datetime.now()

    def smart_delay(self) -> float:
        """השהיה דינמית בהתאם להצלחות רצופות."""
        # מנגנון השהיה אגרסיבי יותר אם יש הצלחות רצופות רבות
        if self.consecutive_successes > 20: # 20 הצלחות רצופות
            return random.uniform(0.5, 3) # קיצור השהיה
        elif self.consecutive_successes < 5: # פחות מ-5 הצלחות רצופות (או כישלונות)
            return random.uniform(5, 15) # הארכת השהיה
        return random.uniform(2, 8) # השהיה רגילה

    async def handle_flood_wait_for_client(self, client: TelegramClient, e: errors.FloodWaitError):
        """מעדכן את זמני ההמתנה עבור חשבון ספציפי במקרה של FloodWait."""
        client_name = getattr(client, '_account_info', 'לא ידוע')
        wait_time = e.seconds + random.uniform(2, 7) # מוסיף אקראיות להמתנה
        # שומר את זמן ההמתנה הספציפי עבור ה-auth_key של הלקוח
        self.client_flood_wait_until[client.session.auth_key.key_id] = datetime.now() + timedelta(seconds=wait_time)
        logger.warning(f"⏰ FloodWait עבור חשבון [{client_name}]. ימתין {wait_time:.1f} שניות. חשבון זה לא ישלח הודעות עד אז.")


    async def load_clients(self, sessions_file: str) -> List[TelegramClient]:
        """טעינת חשבונות מקובץ sessions.json וחיבור לטלגרם."""
        try:
            with open(sessions_file, 'r', encoding='utf-8') as f:
                sessions = json.load(f)
        except FileNotFoundError:
            logger.error(f"❌ קובץ {sessions_file} לא נמצא. וודא שהוא קיים ומכיל נתוני התחברות.")
            return []
        except json.JSONDecodeError:
            logger.error(f"❌ שגיאה בקריאת קובץ {sessions_file}. וודא שמבנה ה-JSON תקין.")
            return []

        clients = []
        for i, sess in enumerate(sessions):
            phone = sess.get('phone', f'חשבון #{i+1} (טלפון לא ידוע)')
            try:
                api_id = sess.get('api_id')
                api_hash = sess.get('api_hash')
                session_string = sess.get('session_string')
                use_tor = sess.get('use_tor', False)

                if not all([api_id, api_hash, session_string]):
                    logger.error(f"❌ חסרים נתונים (api_id, api_hash, או session_string) בחשבון {phone}. מדלג.")
                    continue

                proxy = (socks.SOCKS5, '127.0.0.1', 9050) if use_tor else None

                session = StringSession(session_string)

                client = TelegramClient(
                    session,
                    api_id,
                    api_hash,
                    proxy=proxy,
                    connection_retries=5,
                    retry_delay=5,
                    timeout=30
                )

                logger.info(f"🔄 מתחבר לחשבון {phone}...")
                await client.connect()

                if not await client.is_user_authorized():
                    logger.warning(f"❌ חשבון {phone} לא מאושר. ייתכן שפג תוקף הסשן או שיש צורך באימות נוסף.")
                    await client.disconnect()
                    continue

                me = await client.get_me()
                logger.info(f"✅ חשבון {me.first_name} ({phone}) נטען בהצלחה.")
                client._account_info = f"{me.first_name} ({phone})" # שמירת מידע לוגים על הלקוח
                clients.append(client)

            except errors.AuthKeyUnregisteredError:
                logger.error(f"❌ חשבון {phone}: שגיאת מפתח אימות לא רשום. יש ליצור session_string חדש.")
            except errors.FloodWaitError as e:
                logger.warning(f"⏰ חשבון {phone}: FloodWait בזמן התחברות. ממתין {e.seconds} שניות.")
                await asyncio.sleep(e.seconds)
            except Exception as e:
                logger.error(f"❌ שגיאה בטעינת חשבון {phone}: {e}")

        return clients

    async def _choose_chat_entity(self, client: TelegramClient, prompt_type: str):
        """פונקציית עזר לבחירת ערוץ/קבוצה (מקור או יעד)."""
        logger.info(f"\n--- בחירת ערוץ {prompt_type} ---")
        logger.info("טיפ: כדי למצוא מזהה (ID) של ערוץ, העבר ממנו הודעה לבוט @userinfobot.")
        logger.info("מזהה ערוץ הוא בדרך כלל מספר שלילי שמתחיל ב-100- (לדוגמה: -100123456789).")

        while True:
            print(f"\nאפשרויות לבחירת ערוץ {prompt_type}:")
            print("1. הזן מזהה/שם ערוץ ידנית")
            print("2. הצג רשימת ערוצים זמינים (עד 20 ראשונים)")

            choice = input("בחר אפשרות (1/2): ").strip()

            if choice == "2":
                available_chats = await self.list_available_chats(client)
                if available_chats:
                    try:
                        selection = int(input(f"\nבחר מספר ערוץ מהרשימה (1-{len(available_chats)}): ")) - 1
                        if 0 <= selection < len(available_chats):
                            selected_chat = available_chats[selection]
                            logger.info(f"✅ נבחר: {selected_chat['title']}")
                            return selected_chat['entity']
                        else:
                            logger.error("❌ מספר לא תקין")
                    except ValueError:
                        logger.error("❌ נא הזן מספר תקין")
                continue

            elif choice == "1" or choice == "":
                entity_input = input(f"הזן ערוץ {prompt_type} (כגון @channel או -100..., או קישור): ").strip()
                if not entity_input:
                    continue

                try:
                    entity = await client.get_entity(entity_input)
                    logger.info(f"DEBUG: Chosen entity for {prompt_type}: Title='{entity.title}', ID={entity.id}, Type={type(entity).__name__}, IsChannel={getattr(entity, 'broadcast', False)}, IsMegaGroup={getattr(entity, 'megagroup', False)}, IsForum={getattr(entity, 'forum', False)}, LinkedChatID={getattr(entity, 'linked_chat_id', None)}")
                    logger.info(f"✅ ערוץ {prompt_type} נמצא: {entity.title}")
                    return entity
                except Exception as e:
                    logger.warning(f"❌ שגיאה בחיפוש ישיר: {e}. מנסה וריאציות...")
                    variations_to_try = []
                    if entity_input.startswith('@'):
                        variations_to_try.append(entity_input)
                    elif entity_input.isdigit():
                        variations_to_try.extend([
                            int(entity_input),
                            int(f"-100{entity_input}")
                        ])
                    elif entity_input.startswith('-100') and entity_input[4:].isdigit():
                        variations_to_try.extend([
                            int(entity_input),
                            int(entity_input[4:])
                        ])
                    elif entity_input.startswith('-') and entity_input[1:].isdigit():
                        variations_to_try.extend([
                            int(entity_input),
                            int(f"-100{entity_input[1:]}")
                        ])
                    if "t.me" in entity_input:
                        variations_to_try.append(entity_input)
                    if entity_input.replace('-', '').isdigit(): # לטפל במקרים שבהם מוזן ID עם מינוס או בלי
                        numeric_id = int(entity_input.replace('-', ''))
                        if numeric_id not in variations_to_try:
                            variations_to_try.append(numeric_id)
                        if -numeric_id not in variations_to_try:
                            variations_to_try.append(-numeric_id)
                        if -100 * numeric_id not in variations_to_try and numeric_id > 1000000:
                             variations_to_try.append(-100 * numeric_id)

                    for i, variation in enumerate(variations_to_try, 1):
                        try:
                            logger.info(f"   ניסיון {i}: {variation}")
                            entity = await client.get_entity(variation)
                            logger.info(f"DEBUG: Chosen entity for {prompt_type} (variation {i}): Title='{entity.title}', ID={entity.id}, Type={type(entity).__name__}, IsChannel={getattr(entity, 'broadcast', False)}, IsMegaGroup={getattr(entity, 'megagroup', False)}, IsForum={getattr(entity, 'forum', False)}, LinkedChatID={getattr(entity, 'linked_chat_id', None)}")
                            logger.info(f"✅ ערוץ {prompt_type} נמצא: {entity.title}")
                            return entity
                        except Exception as e:
                            logger.warning(f"   ❌ לא עבד: {e}")
                            continue

                    logger.info(f"🔍 מחפש בדיאלוגים הקיימים עבור ערוץ {prompt_type}...")
                    try:
                        dialogs = await client.get_dialogs()
                        for dialog in dialogs:
                            if entity_input.lower() in dialog.title.lower() or \
                               (hasattr(dialog.entity, 'username') and dialog.entity.username and entity_input.replace('@', '').lower() == dialog.entity.username.lower()):
                                logger.info(f"✅ נמצא ערוץ לפי שם/שם משתמש: {dialog.title}")
                                return dialog.entity
                            dialog_id_str = str(dialog.entity.id)
                            if entity_input in [dialog_id_str, f"-{dialog_id_str}", f"-100{dialog_id_str}"]:
                                logger.info(f"✅ נמצא ערוץ לפי מזהה: {dialog.title}")
                                return dialog.entity
                        logger.error(f"❌ לא נמצא ערוץ {prompt_type} מתאים בדיאלוגים")
                    except Exception as e:
                        logger.error(f"❌ שגיאה בחיפוש בדיאלוגים עבור ערוץ {prompt_type}: {e}")

                logger.info(f"\n💡 עצות נוספות לערוץ {prompt_type}:")
                logger.info("  - וודא שהחשבון חבר בערוץ/קבוצה המבוקשת.")
                logger.info("  - נסה להשתמש באפשרות 2 (רשימת ערוצים).")
                logger.info("  - אם יש לך לינק לערוץ, נסה לחלץ את השם ממנו.")
                logger.info("  - עבור ערוצים פרטיים, וודא שיש לך גישה/הזמנה.")
                continue
            else:
                logger.error("❌ אפשרות לא תקינה")

    async def choose_source_channel(self, client: TelegramClient):
        """בחירת ערוץ מקור ממנו ההודעות יועברו (משתמש בפונקציית עזר)."""
        return await self._choose_chat_entity(client, "מקור")

    async def choose_target_channel(self, client: TelegramClient):
        """בחירת ערוץ יעד אליו ההודעות יועברו (משתמש בפונקציית עזר)."""
        return await self._choose_chat_entity(client, "יעד")

    async def list_available_chats(self, client: TelegramClient):
        """הצגת רשימת ערוצים וקבוצות זמינים לחשבון הנוכחי."""
        logger.info("\n📋 ערוצים וקבוצות זמינים (עד 20 ראשונים):")
        try:
            dialogs = await client.get_dialogs()
            channels_and_groups = []

            for dialog in dialogs:
                if hasattr(dialog.entity, 'broadcast') or hasattr(dialog.entity, 'megagroup'):
                    entity_type = "ערוץ" if getattr(dialog.entity, 'broadcast', False) else "קבוצה"
                    username = getattr(dialog.entity, 'username', None)
                    username_str = f"@{username}" if username else "אין שם משתמש"

                    entity_id = dialog.entity.id
                    display_id = f"-100{entity_id}" if entity_type == "ערוץ" or getattr(dialog.entity, 'megagroup', False) else str(entity_id)

                    channels_and_groups.append({
                        'title': dialog.title,
                        'id': entity_id,
                        'display_id': display_id,
                        'username': username_str,
                        'type': entity_type,
                        'entity': dialog.entity
                    })

            if channels_and_groups:
                for i, chat in enumerate(channels_and_groups[:20], 1):
                    print(f"{i}. {chat['title']} ({chat['type']}) - {chat['username']} - ID: {chat['display_id']}")
                return channels_and_groups
            else:
                logger.warning("❌ לא נמצאו ערוצים או קבוצות")
                return []

        except Exception as e:
            logger.error(f"❌ שגיאה בקבלת רשימת ערוצים: {e}")
            return []

    def choose_file_types(self) -> List[str]:
        """בחירת סוגי קבצים/תוכן לשליחה."""
        print("\nבחר את סוגי התוכן לשליחה:")
        print("1. טקסט בלבד")
        print("2. תמונות (jpg, png, gif, webp)")
        print("3. וידאו (mp4, avi, mkv, mov, wmv)")
        print("4. אודיו (mp3, wav, flac, aac, ogg)")
        print("5. מסמכים (pdf, doc, docx, txt, rtf)")
        print("6. הכל (כולל טקסט וכל סוגי המדיה)")
        print("7. מותאם אישית (הזן סיומות קבצים מופרדות בפסיק, לדוגמה: jpg,mp4,pdf)")

        while True:
            choice = input("הזן מספר בחירה (1-7, או השאר ריק לטקסט בלבד): ").strip()

            type_mappings = {
                '1': ['text_only'],
                '2': ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                '3': ['mp4', 'avi', 'mkv', 'mov', 'wmv'],
                '4': ['mp3', 'wav', 'flac', 'aac', 'ogg'],
                '5': ['pdf', 'doc', 'docx', 'txt', 'rtf'],
                '6': ['all_media', 'all_text'],
                '7': None, # מטופל בנפרד
                '': ['text_only']
            }

            if choice == '7':
                custom = input("הזן סוגי קבצים מופרדים בפסיק (כגון: jpg,mp4,pdf) או 'text' לטקסט: ").strip()
                if custom:
                    parsed_types = [t.strip().lower() for t in custom.split(',') if t.strip()]
                    if 'text' in parsed_types:
                        parsed_types.remove('text')
                        parsed_types.append('text_only')
                    return parsed_types
                else:
                    logger.warning("❌ לא הוזנו סוגי תוכן, נסה שוב.")
                    continue
            elif choice in type_mappings:
                return type_mappings[choice]
            else:
                logger.error("❌ אפשרות לא תקינה, נסה שוב.")
                continue

    def choose_reset_progress(self) -> bool:
        """בחירה האם לאפס התקדמות או להמשיך."""
        print("\nאפשרויות העברת הודעות:")
        print("1. התחל מחדש (התעלם מהתקדמות קודמת, ינסה להעביר את כל ההודעות הזמינות בערוץ המקור)")
        print("2. המשך מההתקדמות הקודמת (יעביר רק הודעות חדשות מערוץ המקור, החל מההודעה האחרונה שנשלחה בהצלחה)")

        while True:
            choice = input("בחר אפשרות (1/2): ").strip()

            if choice == "1" or choice == "":
                logger.info("✅ יתחיל העברה מחדש.")
                return True
            elif choice == "2":
                logger.info("✅ ימשיך מההתקדמות הקודמת.")
                return False
            else:
                logger.error("❌ אפשרות לא תקינה, נסה שוב.")

    def random_batch_size(self) -> int:
        """מחזיר גודל סבב אקראי בין 5 ל-15 הודעות."""
        return random.randint(5, 15)

    async def send_single_message(self, client: TelegramClient, target_entity, source_message: Message, file_types: List[str]) -> bool:
        """שליחת הודעה (טקסט או מדיה) מערוץ מקור לערוץ יעד."""
        client_name = getattr(client, '_account_info', 'לא ידוע')
        message_info = f"ID: {source_message.id}"

        # בדוק אם הלקוח נמצא כרגע בהמתנת FloodWait
        if client.session.auth_key.key_id in self.client_flood_wait_until and \
           datetime.now() < self.client_flood_wait_until[client.session.auth_key.key_id]:
            logger.warning(f"⏳ חשבון [{client_name}] עדיין נמצא בהמתנת FloodWait. מדלג על הודעה זו כרגע.")
            return False # מציין שחשבון זה לא יכול לשלוח כעת

        try:
            await self.בדוק_הגבלות() # בדיקת קצב שליחה לפני כל ניסיון שליחה

            effective_target_entity = target_entity
            message_thread_id = None

            # אם היעד הוא Channel ויש לו קבוצת דיון מקושרת (linked_chat_id)
            if isinstance(target_entity, Channel) and hasattr(target_entity, 'linked_chat_id') and target_entity.linked_chat_id:
                try:
                    linked_chat = await client.get_entity(target_entity.linked_chat_id)
                    # וודא שהקבוצה המקושרת היא אכן Chat (Supergroup) ופורום
                    if isinstance(linked_chat, Chat) and getattr(linked_chat, 'forum', False):
                        effective_target_entity = linked_chat
                        message_thread_id = 1 # ID של הנושא הכללי בפורום (ברוב המקרים 1)
                        logger.info(f"💡 ערוץ יעד '{target_entity.title}' מקושר לפורום. שולח לנושא הכללי (ID: {message_thread_id}) בקבוצת הדיון המקושרת: {linked_chat.title}")
                    else:
                        # אם מקושר לקבוצה אבל לא פורום, שולח לקבוצה המקושרת ללא thread_id
                        logger.warning(f"⚠️ ערוץ יעד '{target_entity.title}' מקושר לקבוצה ({linked_chat.title}), אך היא אינה פורום. הודעות יישלחו ישירות לקבוצה המקושרת ללא נושא.")
                        effective_target_entity = linked_chat
                        message_thread_id = None # וודא שאין message_thread_id
                except Exception as e:
                    logger.error(f"❌ שגיאה באחזור קבוצת הדיון המקושרת לערוץ {target_entity.title}: {e}. שולח ליעד המקורי.")
                    # חוזר ליעד המקורי אם הייתה בעיה עם הקבוצה המקושרת
                    effective_target_entity = target_entity
                    message_thread_id = None # וודא שאין message_thread_id

            # אם היעד הוא Chat (קבוצה) ומוגדר כפורום (ולא עבר דרך linked_chat_id מערוץ)
            elif isinstance(target_entity, Chat) and getattr(target_entity, 'forum', False):
                 message_thread_id = 1 # ID של הנושא הכללי (בדרך כלל 1)
                 logger.info(f"💡 ערוץ יעד '{target_entity.title}' הוא פורום. שולח לנושא הכללי (ID: {message_thread_id}).")

            # קבל InputPeer עבור היעד האפקטיבי (הערוץ המקורי, הקבוצה המקושרת, או הקבוצה שהיא פורום)
            input_effective_target_entity = await client.get_input_entity(effective_target_entity)

            send_kwargs = {}
            if message_thread_id is not None:
                send_kwargs['message_thread_id'] = message_thread_id
            
            logger.debug(f"DEBUG: Attempting to send message {message_info} from [{client_name}] to target. Effective Target: {effective_target_entity.title} (Type: {type(effective_target_entity).__name__}), Thread ID: {message_thread_id}, Send_kwargs: {send_kwargs}")

            # --- לוגיקה חדשה לשליחת הודעות ללא קרדיט ---
            if source_message.media:
                should_send_media = False
                # בדיקת סוג המדיה והתאמה לסוגי הקבצים שנבחרו
                if 'all_media' in file_types:
                    should_send_media = True
                elif isinstance(source_message.media, MessageMediaPhoto) and any(ext in ['jpg', 'jpeg', 'png', 'gif', 'webp'] for ext in file_types):
                    should_send_media = True
                elif isinstance(source_message.media, MessageMediaDocument):
                    mime_type = source_message.media.document.mime_type if source_message.media.document else ''
                    file_ext = None
                    if source_message.media.document and source_message.media.document.attributes:
                        for attr in source_message.media.document.attributes:
                            if hasattr(attr, 'file_name') and attr.file_name:
                                file_ext = attr.file_name.lower().split('.')[-1]
                                break

                    if ('video' in mime_type and any(ext in ['mp4', 'avi', 'mkv', 'mov', 'wmv'] for ext in file_types)):
                        should_send_media = True
                    elif ('audio' in mime_type and any(ext in ['mp3', 'wav', 'flac', 'aac', 'ogg'] for ext in file_types)):
                        should_send_media = True
                    elif (('application/pdf' in mime_type) or (file_ext == 'pdf')) and ('pdf' in file_types):
                        should_send_media = True
                    elif (('application/msword' in mime_type) or ('application/vnd.openxmlformats-officedocument.wordprocessingml.document' in mime_type) or (file_ext in ['doc', 'docx'])) and any(ext in ['doc', 'docx'] for ext in file_types):
                        should_send_media = True
                    elif (('text/plain' in mime_type) or (file_ext == 'txt')) and ('txt' in file_types):
                        should_send_media = True
                    elif file_ext and file_ext in file_types: # עבור סיומות קבצים מותאמות אישית
                        should_send_media = True

                if should_send_media:
                    file_to_send = source_message.photo if isinstance(source_message.media, MessageMediaPhoto) else source_message.document
                    
                    if file_to_send: # וודא שיש קובץ לשלוח
                        await client.send_file(
                            input_effective_target_entity,
                            file=file_to_send,
                            caption=source_message.text if source_message.text else '', # העבר כיתוב אם קיים
                            **send_kwargs
                        )
                        logger.info(f"✅ [{client_name}] הועברה מדיה (ID: {message_info}) ללא קרדיט. כיתוב: {source_message.text[:50]}...")
                        self.מונה_הודעות_בדקה += 1
                    else:
                        logger.warning(f"⚠️ [{client_name}] מדלג על הודעת מדיה (ID: {message_info}) ללא קובץ ניתן לשליחה.")
                        return True # דלג בהצלחה על הודעה לא ניתנת לשליחה
                else:
                    logger.info(f"⏩ [{client_name}] מדלג על מדיה (ID: {message_info}) - סוג קובץ לא תואם את ההגדרות הנבחרות.")
                    return True

            elif source_message.text:
                if 'text_only' in file_types or 'all_media' in file_types or 'all_text' in file_types:
                    await client.send_message(input_effective_target_entity, message=source_message.text, **send_kwargs)
                    logger.info(f"✅ [{client_name}] נשלחה הודעת טקסט (ID: {message_info}) ללא קרדיט: {source_message.text[:50]}...")
                    self.מונה_הודעות_בדקה += 1
                else:
                    logger.info(f"⏩ [{client_name}] מדלג על הודעת טקסט (ID: {message_info}) - נבחרו סוגי מדיה ספציפיים בלבד.")
                    return True
            else:
                logger.info(f"⏩ [{client_name}] מדלג על הודעה ריקה או ללא תוכן נתמך (ID: {message_info}).")
                return True

            return True

        except errors.FloodWaitError as e:
            await self.handle_flood_wait_for_client(client, e)
            raise # העלה מחדש את השגיאה כדי ש-send_messages_batch יטפל בה

        except errors.ChatWriteForbiddenError:
            logger.error(f"❌ אין הרשאה לכתיבה בערוץ יעד זה. [{client_name}]")
            self.consecutive_successes = 0 # איפוס מונה הצלחות
            return False
        except Exception as e:
            logger.error(f"❌ שגיאה בהעברת הודעה {message_info}: {e}. [{client_name}]", exc_info=True)
            self.consecutive_successes = 0 # איפוס מונה הצלחות
            return False

    async def send_messages_batch(self, target_entity, messages: List[Message], file_types: List[str]) -> List[Message]:
        """שליחת אצווה של הודעות באמצעות מספר לקוחות באופן מבוקר."""
        tasks_with_messages = []
        messages_for_next_retry = [] # הודעות שצריכות ניסיון חוזר (לדוגמה, עקב FloodWait)
        
        # מחלק את ההודעות בין הלקוחות הזמינים (שאינם תחת FloodWait)
        available_clients_for_batch = []
        for client in self.clients:
            # וודא שהלקוח תקין ויכול להיבדק עבור session ו-auth_key
            if hasattr(client, 'session') and hasattr(client.session, 'auth_key') and hasattr(client.session.auth_key, 'key_id'):
                if client.session.auth_key.key_id not in self.client_flood_wait_until or \
                   datetime.now() >= self.client_flood_wait_until[client.session.auth_key.key_id]:
                    available_clients_for_batch.append(client)
                else:
                    client_name = getattr(client, '_account_info', 'לא ידוע')
                    logger.info(f"⏳ חשבון [{client_name}] עדיין נמצא בהמתנת FloodWait. לא ישתתף באצווה זו.")
            else:
                client_name = getattr(client, '_account_info', 'לא ידוע')
                logger.warning(f"⚠️ חשבון [{client_name}] לא תקין או חסר מידע session/auth_key. לא ישתתף באצווה זו.")


        if not available_clients_for_batch and messages: # אם אין לקוחות זמינים ויש הודעות לשלוח
            logger.warning("⚠️ כל החשבונות נמצאים כרגע תחת הגבלת FloodWait או אינם זמינים. ממתין 30 שניות ומנסה שוב.")
            await asyncio.sleep(30) # המתנה כללית
            return messages # החזר את כל ההודעות לניסיון חוזר

        client_cycle = asyncio.Queue()
        for client in available_clients_for_batch:
            await client_cycle.put(client)

        for message in messages:
            if client_cycle.empty():
                messages_for_next_retry.append(message)
                continue # אין לקוחות זמינים כרגע להודעה זו

            client_for_task = await client_cycle.get()
            tasks_with_messages.append((self.send_single_message(client_for_task, target_entity, message, file_types), message, client_for_task))
            await client_cycle.put(client_for_task) # החזר את הלקוח לתור לסיבוב הבא

        # הפעל את המשימות במקביל
        results = await asyncio.gather(*[task for task, _, _ in tasks_with_messages], return_exceptions=True)

        for i, result in enumerate(results):
            original_task, original_message, client_used = tasks_with_messages[i] # קבל את ההודעה המקורית והלקוח
            
            if isinstance(result, errors.FloodWaitError):
                logger.warning(f"❌ הודעה (ID: {original_message.id}) נכשלה עקב FloodWait עבור חשבון [{getattr(client_used, '_account_info', 'לא ידוע')}]. תנסה שוב באצווה הבאה.")
                messages_for_next_retry.append(original_message)
                self.consecutive_successes = 0 # איפוס מונה ההצלחות
            elif not result: # False מציין כישלון (כמו ChatWriteForbiddenError או Exception כללי)
                logger.warning(f"❌ הודעה (ID: {original_message.id}) לא נשלחה עקב שגיאה כללית עבור חשבון [{getattr(client_used, '_account_info', 'לא ידוע')}]. תנסה שוב באצווה הבאה.")
                messages_for_next_retry.append(original_message)
                self.consecutive_successes = 0 # איפוס מונה ההצלחות
            elif result: # True (הצלחה)
                # אם הכל עבר בהצלחה, זה כבר נשמר ב-send_single_message (self.sent_message_ids, self.last_processed_message_id)
                self.consecutive_successes += 1
            else: # לא אמור לקרות, אבל למקרה בטיחות
                logger.error(f"❌ תוצאה לא צפויה עבור הודעה (ID: {original_message.id}): {result}. תנסה שוב.")
                messages_for_next_retry.append(original_message)
                self.consecutive_successes = 0 # איפוס מונה ההצלחות
        
        return messages_for_next_retry # החזר הודעות שצריכות ניסיון חוזר


    async def send_messages_round(self, source_entity, target_entity, file_types: List[str], reset_progress: bool = False):
        """שליחת הודעות בסבבים עם חלוקה הוגנת בין החשבונות מערוץ מקור לערוץ יעד."""
        if not self.clients:
            logger.error("❌ אין חשבונות זמינים.")
            return

        if reset_progress:
            self.sent_message_ids.clear()
            self.last_processed_message_id = 0
            current_fetch_offset_id = 0
            self.save_progress() # שמירת איפוס ההתקדמות
            logger.info("🔄 מאפס התקדמות - יתחיל להעביר הודעות מתחילת ערוץ המקור (ID > 0).")
        else:
            current_fetch_offset_id = self.last_processed_message_id
            logger.info(f"✅ ימשיך העברת הודעות מ-ID: {current_fetch_offset_id} בערוץ המקור (יביא הודעות עם ID גבוה יותר).")

        logger.info(f"📤 מתחיל העברת הודעות מ'{source_entity.title}' ל'{target_entity.title}' עם {len(self.clients)} חשבונות.")

        messages_retrying_this_round = [] # הודעות שניסינו לשלוח באצווה הנוכחית ונצטרך לנסות שוב
        
        batch_count = 0
        total_sent_in_run = 0

        while True:
            batch_count += 1
            messages_in_current_fetch = []

            # קודם כל נסה הודעות מתור הניסיונות החוזרים
            if messages_retrying_this_round:
                messages_to_process = messages_retrying_this_round
                messages_retrying_this_round = [] # נקה את התור
                logger.info(f"🔁 מעבד {len(messages_to_process)} הודעות מתור הניסיונות החוזרים.")
            else:
                # אם אין הודעות לניסיון חוזר, נסה לאחזר חדשות
                try:
                    messages_generator = self.clients[0].iter_messages(
                        source_entity,
                        offset_id=current_fetch_offset_id,
                        reverse=True, # סדר כרונולוגי: מהישנה לחדשה
                        limit=self.random_batch_size() # אחזור אצווה בגודל אקראי
                    )
                    
                    async for message in messages_generator:
                        # דלג על הודעות שסומנו בעבר כנשלחו
                        if message.id not in self.sent_message_ids:
                            messages_in_current_fetch.append(message)
                        # עדכן את ה-last_processed_message_id רק עבור הודעות חדשות שטרם נשלחו
                        if message.id > current_fetch_offset_id:
                            current_fetch_offset_id = message.id 

                    if not messages_in_current_fetch and not messages_retrying_this_round: # אם אין חדשות וגם אין לנסות שוב
                        logger.info("✅ אין הודעות חדשות לשליחה כרגע בערוץ המקור או שהגענו לסוף ההיסטוריה הזמינה.")
                        break # יציאה מהלולאה אם אין יותר מה לעשות

                    logger.info(f"✅ נמצאו {len(messages_in_current_fetch)} הודעות באצווה {batch_count} לשליחה (כולל דלוגים פוטנציאליים).")
                    messages_to_process = messages_in_current_fetch

                except errors.FloodWaitError as e:
                    logger.warning(f"⏰ FloodWait בעת אחזור אצווה מערוץ המקור. ממתין {e.seconds} שניות.")
                    await asyncio.sleep(e.seconds)
                    continue # נסה לאחזר את אותה אצווה שוב לאחר ההמתנה
                except Exception as e:
                    logger.error(f"❌ שגיאה קריטית באחזור אצווה מערוץ המקור: {e}", exc_info=True)
                    break # יציאה אם יש שגיאה קריטית באחזור

            if messages_to_process:
                # שליחת האצווה וקבלת הודעות שניסיונן נכשל
                messages_that_failed_in_batch = await self.send_messages_batch(target_entity, messages_to_process, file_types)
                messages_retrying_this_round.extend(messages_that_failed_in_batch)
                # כמה נשלחו בפועל באצווה זו (הודעות שהיו בתור לעיבוד פחות אלה שנכשלו)
                total_sent_in_run += (len(messages_to_process) - len(messages_that_failed_in_batch)) 

            else: # אם הגענו לכאן ואין הודעות לעיבוד (גם לא ניסיונות חוזרים)
                logger.info("✅ כל ההודעות הזמינות עובדו או נכשלו באופן סופי.")
                break


            # השהייה דינמית בין אצוות או ניסיונות חוזרים
            delay = self.smart_delay()
            logger.info(f"⏳ ממתין {delay:.1f} שניות (השהיה דינמית)...")
            await asyncio.sleep(delay)

        logger.info(f"\n✅ העברת הודעות הסתיימה. סה\"כ נשלחו {total_sent_in_run} הודעות בהרצה זו.")

    async def run(self):
        """הפעלת הסקריפט הראשי."""
        logger.info("=== 📱 מעביר הודעות טלגרם (גרסה מתקדמת) ===\n")

        self.clients = await self.load_clients(SESSIONS_FILE)
        if not self.clients:
            logger.error("❌ לא נטענו חשבונות, יוצא.")
            return

        self.load_progress()

        source_entity = await self.choose_source_channel(self.clients[0])
        if not source_entity:
            logger.error("❌ לא נבחר ערוץ מקור, יוצא.")
            return

        target_entity = await self.choose_target_channel(self.clients[0])
        if not target_entity:
            logger.error("❌ לא נבחר ערוץ יעד, יוצא.")
            return
        
        # --- בדיקת שליחה מוקדמת לכל חשבון ---
        logger.info("\n--- בדיקת יכולת שליחה לערוץ היעד עבור כל החשבונות ---")
        for client in self.clients:
            client_name = getattr(client, '_account_info', 'לא ידוע')
            try:
                # נסה לשלוח הודעת בדיקה קצרה
                test_message_text = f"בדיקה: חשבון [{client_name}] יכול לשלוח לערוץ '{target_entity.title}'."
                
                effective_target_for_test = target_entity
                test_thread_id = None
                
                # העתק את לוגיקת זיהוי הפורום גם לכאן לצורך בדיקה מדויקת
                if isinstance(target_entity, Channel) and hasattr(target_entity, 'linked_chat_id') and target_entity.linked_chat_id:
                    try:
                        linked_chat_test = await client.get_entity(target_entity.linked_chat_id)
                        if isinstance(linked_chat_test, Chat) and getattr(linked_chat_test, 'forum', False):
                            effective_target_for_test = linked_chat_test
                            test_thread_id = 1
                    except Exception as e:
                        logger.warning(f"⚠️ [{client_name}] שגיאה בבדיקת קבוצת דיון מקושרת עבור '{target_entity.title}': {e}")
                elif isinstance(target_entity, Chat) and getattr(target_entity, 'forum', False):
                    test_thread_id = 1
                
                test_kwargs = {}
                if test_thread_id is not None:
                    test_kwargs['message_thread_id'] = test_thread_id

                await client.send_message(effective_target_for_test, message=test_message_text, **test_kwargs)
                logger.info(f"✅ חשבון [{client_name}] עבר את בדיקת השליחה לערוץ היעד.")
                await asyncio.sleep(self.smart_delay()) # השהיה קצרה בין בדיקות
            except errors.ChannelInvalidError as e:
                logger.critical(f"❌ חשבון [{client_name}] נכשל בבדיקת השליחה לערוץ היעד '{target_entity.title}'. שגיאה: {e}. יש לבדוק הרשאות או סוג ערוץ/קבוצה.")
                # אם חשבון נכשל בבדיקה המוקדמת, נוציא אותו זמנית מרשימת הלקוחות הפעילים.
                # חשוב: זה לא יגרום לו לצאת מהריצה כולה, רק לא להיבחר לשליחה.
                if client.session.auth_key.key_id not in self.client_flood_wait_until: # וודא שזה לא סומן כבר כ-FloodWait
                    self.client_flood_wait_until[client.session.auth_key.key_id] = datetime.now() + timedelta(days=999) # סמן כחסום לתמיד לצורך הבדיקה
                # ניתן גם להוציא מהרשימה ממש: self.clients.remove(client)
                # אך עדיף לסמן אותו כך שהוא לא יבחר לשליחה.
            except Exception as e:
                logger.critical(f"❌ חשבון [{client_name}] נכשל בבדיקת השליחה לערוץ היעד '{target_entity.title}' עם שגיאה לא צפויה: {e}", exc_info=True)
                if client.session.auth_key.key_id not in self.client_flood_wait_until:
                    self.client_flood_wait_until[client.session.auth_key.key_id] = datetime.now() + timedelta(days=999) # סמן כחסום לתמיד

        # נותרנו רק עם הלקוחות שעברו את הבדיקה או שהם לא תחת חסימה קבועה
        self.clients = [client for client in self.clients if client.session.auth_key.key_id not in self.client_flood_wait_until or datetime.now() < self.client_flood_wait_until[client.session.auth_key.key_id]]
        if not self.clients:
            logger.critical("❌ אף חשבון לא עבר את בדיקת השליחה לערוץ היעד. לא ניתן להמשיך.")
            return

        logger.info("\n--- סיום בדיקת יכולת שליחה ---")
        # --- סוף בדיקת שליחה מוקדמת ---


        file_types = self.choose_file_types()
        if 'text_only' in file_types:
            logger.info("✅ נבחרו הודעות טקסט בלבד. קבצי מדיה ידלגו.")
        elif 'all_media' in file_types and 'all_text' in file_types:
            logger.info("✅ נבחרו כל סוגי התוכן (טקסט ומדיה).")
        elif 'all_media' in file_types:
            logger.info("✅ נבחרו כל סוגי המדיה בלבד. הודעות טקסט פשוטות ידלגו.")
        else:
            logger.info(f"✅ סוגי קבצים נבחרים: {', '.join(file_types)}. הודעות טקסט פשוטות ידלגו.")

        reset_progress = False
        if self.sent_message_ids or self.last_processed_message_id > 0:
            reset_progress = self.choose_reset_progress()

        try:
            await self.send_messages_round(source_entity, target_entity, file_types, reset_progress)
            logger.info("\n🎉 העברת ההודעות הושלמה בהצלחה!")

        except KeyboardInterrupt:
            logger.info("\n⏹️ העברת ההודעות הופסקה על ידי המשתמש.")
            self.save_progress()

        except Exception as e:
            logger.critical(f"\n❌ שגיאה כללית במהלך ההעברה: {e}", exc_info=True)
            self.save_progress()

        finally:
            for client in self.clients:
                try:
                    if client.is_connected():
                        await client.disconnect()
                except Exception as e:
                    logger.error(f"שגיאה בניתוק חשבון: {e}")
            logger.info("✅ כל החשבונות נותקו.")

async def main():
    sender = TelegramSender()
    await sender.run()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n👋 התוכנית נסגרה על ידי המשתמש.")

