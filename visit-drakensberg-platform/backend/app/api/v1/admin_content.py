import json
import mimetypes
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.core.database import get_supabase, redis
from app.core.security import get_current_admin
from app.models.user import User

router = APIRouter(prefix="/admin/content", tags=["admin-content"])
REGIONS_KEY = "admin:content:regions"
MEDIA_KEY = "admin:content:media"


class KeyAttraction(BaseModel):
    id: str
    name: str
    description: str = ""


class RegionPayload(BaseModel):
    name: str
    tagline: str = ""
    heroImage: str = ""
    heroVideo: str = ""
    overview: str = ""
    highlights: list[str] = Field(default_factory=list)
    gettingThere: str = ""
    bestTime: str = ""
    keyAttractions: list[KeyAttraction] = Field(default_factory=list)
    seoTitle: str = ""
    seoDescription: str = ""


class MediaPayload(BaseModel):
    type: str = "image"
    name: str
    url: str
    size: str = "Unknown"
    dimensions: str = "Unknown"
    used_in: list[str] = Field(default_factory=list)


def read_collection(key: str) -> list[dict]:
    raw = redis.get(key)
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return []


def write_collection(key: str, data: list[dict]) -> None:
    redis.set(key, json.dumps(data))


@router.get("/regions")
async def list_regions(current_user: User = Depends(get_current_admin)):
    return read_collection(REGIONS_KEY)


@router.post("/regions", status_code=status.HTTP_201_CREATED)
async def create_region(payload: RegionPayload, current_user: User = Depends(get_current_admin)):
    regions = read_collection(REGIONS_KEY)
    region = payload.model_dump()
    region["id"] = str(uuid4())
    if not region["seoTitle"]:
        region["seoTitle"] = f"{region['name']} | Visit Drakensberg"
    regions.append(region)
    write_collection(REGIONS_KEY, regions)
    return region


@router.put("/regions/{region_id}")
async def update_region(region_id: str, payload: RegionPayload, current_user: User = Depends(get_current_admin)):
    regions = read_collection(REGIONS_KEY)
    for index, region in enumerate(regions):
        if region.get("id") == region_id:
            updated = payload.model_dump()
            updated["id"] = region_id
            regions[index] = updated
            write_collection(REGIONS_KEY, regions)
            return updated
    raise HTTPException(status_code=404, detail="Region not found")


@router.delete("/regions/{region_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_region(region_id: str, current_user: User = Depends(get_current_admin)):
    regions = read_collection(REGIONS_KEY)
    next_regions = [r for r in regions if r.get("id") != region_id]
    if len(next_regions) == len(regions):
        raise HTTPException(status_code=404, detail="Region not found")
    write_collection(REGIONS_KEY, next_regions)


@router.get("/media")
async def list_media(current_user: User = Depends(get_current_admin)):
    return read_collection(MEDIA_KEY)


@router.post("/media", status_code=status.HTTP_201_CREATED)
async def create_media(payload: MediaPayload, current_user: User = Depends(get_current_admin)):
    media = read_collection(MEDIA_KEY)
    item = payload.model_dump()
    item["id"] = str(uuid4())
    item["uploaded"] = "Just now"
    media.append(item)
    write_collection(MEDIA_KEY, media)
    return item


@router.post("/media/upload", status_code=status.HTTP_201_CREATED)
async def upload_media(file: UploadFile = File(...), current_user: User = Depends(get_current_admin)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    bucket = "media"
    path = f"admin/{uuid4()}-{file.filename}"
    content_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
    supabase = get_supabase()
    supabase.storage.from_(bucket).upload(path, content, {"content-type": content_type})
    public = supabase.storage.from_(bucket).get_public_url(path)
    payload = MediaPayload(
        type="video" if content_type.startswith("video/") else "image",
        name=file.filename,
        url=public,
        size=f"{len(content) / 1024 / 1024:.1f} MB" if len(content) > 1024 * 1024 else f"{len(content) / 1024:.0f} KB",
    )
    return await create_media(payload, current_user)


@router.delete("/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(media_id: str, current_user: User = Depends(get_current_admin)):
    media = read_collection(MEDIA_KEY)
    next_media = [m for m in media if m.get("id") != media_id]
    if len(next_media) == len(media):
        raise HTTPException(status_code=404, detail="Media not found")
    write_collection(MEDIA_KEY, next_media)
