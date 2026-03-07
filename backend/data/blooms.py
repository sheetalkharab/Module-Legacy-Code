import datetime

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from data.connection import db_cursor
from data.users import User, get_user


@dataclass
class RebloomDetails:
    original_bloom_id: int
    rebloomed_by: User

@dataclass
class Bloom:
    id: int
    sender: User
    content: str
    sent_timestamp: datetime.datetime
    type:str= "bloom"
    rebloom_details: Optional[RebloomDetails] = None


def generate_bloom_id() -> int:
    """Generate a unique bloom/rebloom ID based on current timestamp."""
    now = datetime.datetime.now(tz=datetime.UTC)
    return int(now.timestamp() * 1_000_000)    



def add_bloom(*, sender: User, content: str) -> Bloom:
    hashtags = [word[1:] for word in content.split(" ") if word.startswith("#")]

    now = datetime.datetime.now(tz=datetime.UTC)
    bloom_id =  generate_bloom_id()
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO blooms (id, sender_id, content, send_timestamp) VALUES (%(bloom_id)s, %(sender_id)s, %(content)s, %(timestamp)s)",
            dict(
                bloom_id=bloom_id,
                sender_id=sender.id,
                content=content,
                timestamp=datetime.datetime.now(datetime.UTC),
            ),
        )
        for hashtag in hashtags:
            cur.execute(
                "INSERT INTO hashtags (hashtag, bloom_id) VALUES (%(hashtag)s, %(bloom_id)s)",
                dict(hashtag=hashtag, bloom_id=bloom_id),
            )



def get_blooms_for_user(
    username: str, *, before: Optional[int] = None, limit: Optional[int] = None
) -> List[Bloom]:
    with db_cursor() as cur:
        kwargs = {"sender_username": username}

        if before is not None:
            before_clause = "AND send_timestamp < %(before_limit)s"
            kwargs["before_limit"] = before
        else:
            before_clause = ""

        limit_clause = make_limit_clause(limit, kwargs)

        cur.execute(
            f"""
            SELECT
                blooms.id,
                users.username,
                blooms.content,
                blooms.send_timestamp,
                blooms.type,
                blooms.original_bloom_id
            FROM blooms
            INNER JOIN users ON users.id = blooms.sender_id
            WHERE username = %(sender_username)s
            {before_clause}
            ORDER BY send_timestamp DESC
            {limit_clause}
            """,
            kwargs,
        )

        rows = cur.fetchall()
        blooms = []
        for row in rows:
            bloom_id, sender_username, content, timestamp, type_, original_id = row
            sender_user = get_user(sender_username)
            rebloom_details = RebloomDetails(original_bloom_id=original_id, rebloomed_by=sender_user) if original_id else None
            blooms.append(
                Bloom(
                    id=bloom_id,
                    sender=sender_user,
                    content=content,
                    sent_timestamp=timestamp,
                    type=type_,
                    rebloom_details=rebloom_details,
                    
                )
            )
    return blooms



def get_bloom(bloom_id: int) -> Optional[Bloom]:
    with db_cursor() as cur:
        cur.execute(
            "SELECT blooms.id, users.username, content, send_timestamp, type, original_bloom_id FROM blooms INNER JOIN users ON users.id = blooms.sender_id WHERE blooms.id = %s",
            (bloom_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        bloom_id, sender_username, content, timestamp, type_, original_id = row
        sender_user = get_user(sender_username)
        rebloom_details = RebloomDetails(original_bloom_id=original_id, rebloomed_by=sender_user) if original_id else None
        return Bloom(
            id=bloom_id,
            sender=sender_user,
            content=content,
            sent_timestamp=timestamp,
            type=type_,
            rebloom_details=rebloom_details,
           
        )


def get_blooms_with_hashtag(
    hashtag_without_leading_hash: str, *, limit: int = None
) -> List[Bloom]:
    kwargs = {
        "hashtag_without_leading_hash": hashtag_without_leading_hash,
    }
    limit_clause = make_limit_clause(limit, kwargs)
    with db_cursor() as cur:
        cur.execute(
            f"""SELECT
              blooms.id, users.username, blooms.content, blooms.send_timestamp, blooms.type, blooms.original_bloom_id
            FROM
              blooms INNER JOIN hashtags ON blooms.id = hashtags.bloom_id INNER JOIN users ON blooms.sender_id = users.id
            WHERE
              hashtag = %(hashtag_without_leading_hash)s
            ORDER BY blooms.send_timestamp DESC
            {limit_clause}
            """,
            kwargs,
        )
        rows = cur.fetchall()
        blooms = []
        for row in rows:
            bloom_id, sender_username, content, timestamp, type_, original_id = row
            sender_user = get_user(sender_username)
            rebloom_details = RebloomDetails(original_bloom_id=original_id, rebloomed_by=sender_user) if original_id else None
            blooms.append(
                Bloom(
                    id=bloom_id,
                    sender=sender_user,
                    content=content or "",
                    sent_timestamp=timestamp,
                    type=type_ or "bloom",
                    rebloom_details=rebloom_details,
                )
            )
    return blooms


def make_limit_clause(limit: Optional[int], kwargs: Dict[Any, Any]) -> str:
    if limit is not None:
        limit_clause = "LIMIT %(limit)s"
        kwargs["limit"] = limit
    else:
        limit_clause = ""
    return limit_clause



def add_rebloom(*, sender:User, original_bloom_id: int)-> Bloom:
    now = datetime.datetime.now(tz=datetime.UTC)
    rebloom_id= generate_bloom_id()
    with db_cursor() as cur:
        # Insert rebloom
        cur.execute(
            """INSERT INTO blooms (id, sender_id, content, send_timestamp, type, original_bloom_id)
               VALUES (%(rebloom_id)s, %(sender_id)s, %(content)s, %(timestamp)s, 'rebloom', %(original_bloom_id)s)""",
            dict(
                rebloom_id=rebloom_id,
                sender_id=sender.id,
                content=None,  # rebloom doesn’t need its own text
                timestamp=now,
                original_bloom_id=original_bloom_id,
            ),
        )
        # Copy hashtags from original so rebloom appears in hashtag search
        cur.execute(
            """INSERT INTO hashtags (hashtag, bloom_id)
               SELECT hashtag, %(rebloom_id)s FROM hashtags WHERE bloom_id = %(original_bloom_id)s""",
            dict(rebloom_id=rebloom_id, original_bloom_id=original_bloom_id),
        )
    bloom = get_bloom(rebloom_id)
    if bloom:
        bloom.rebloom_details = RebloomDetails(
            original_bloom_id=original_bloom_id,
            rebloomed_by=sender
        )
    return bloom

def get_rebloom_count(bloom_id: int) -> int:
    """Return how many times this bloom has been re-bloomed."""
    with db_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM blooms WHERE original_bloom_id = %s",
            (bloom_id,),
        )
        row = cur.fetchone()
        return row[0] if row else 0


def bloom_to_dict(bloom: Bloom) -> Dict[str, Any]:
    data = {
        "id": bloom.id,
        "sender": bloom.sender.username,
        "content": bloom.content or "",
        "sent_timestamp": bloom.sent_timestamp.isoformat(),
        "type": bloom.type,
        "rebloom_count": get_rebloom_count(bloom.id),
    }
    if bloom.rebloom_details:
        data["original_bloom_id"] = bloom.rebloom_details.original_bloom_id
        data["rebloom_details"] = {
            "original_bloom_id": bloom.rebloom_details.original_bloom_id,
            "rebloomed_by": bloom.rebloom_details.rebloomed_by.username,
        }
        # Include original bloom timestamp so UI can show "Originally X ago"
        original = get_bloom(bloom.rebloom_details.original_bloom_id)
        if original:
            data["original_sent_timestamp"] = original.sent_timestamp.isoformat()
    return data