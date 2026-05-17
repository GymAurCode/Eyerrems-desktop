from pydantic import BaseModel, Field


class MasterSettingOptionCreate(BaseModel):
    category: str = Field(max_length=40)
    code: str = Field(max_length=80)
    label: str = Field(max_length=255)
    sort_order: int = 0
    is_active: bool = True


class MasterSettingOptionUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=255)
    sort_order: int | None = None
    is_active: bool | None = None


class MasterSettingOptionResponse(BaseModel):
    id: int
    category: str
    code: str
    label: str
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True
