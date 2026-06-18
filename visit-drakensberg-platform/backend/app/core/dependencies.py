from typing import Optional
from fastapi import Query


class PaginationParams:
    def __init__(
        self,
        skip: int = Query(default=0, ge=0, description="Number of records to skip"),
        limit: int = Query(default=20, ge=1, le=100, description="Number of records to return"),
    ):
        self.skip = skip
        self.limit = limit


class CommonFilters:
    def __init__(
        self,
        search: Optional[str] = Query(default=None, description="Search term"),
        sort_by: str = Query(default="created_at", description="Field to sort by"),
        sort_order: str = Query(default="desc", regex="^(asc|desc)$", description="Sort order"),
    ):
        self.search = search
        self.sort_by = sort_by
        self.sort_order = sort_order


def get_pagination(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginationParams:
    params = PaginationParams.__new__(PaginationParams)
    params.skip = skip
    params.limit = limit
    return params


def get_filters(
    search: Optional[str] = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
) -> CommonFilters:
    filters = CommonFilters.__new__(CommonFilters)
    filters.search = search
    filters.sort_by = sort_by
    filters.sort_order = sort_order
    return filters
