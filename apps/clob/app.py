from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from apis.routes import trading, account, market_data, ws_depth, ws_user
from middleware import BodyAutoDetectMiddleware

app = FastAPI(
    title="Test Environment",
    description="API for testing orderbook",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust origins for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(BodyAutoDetectMiddleware)

router = APIRouter()
router.include_router(trading.router)
router.include_router(account.router)
router.include_router(market_data.router)
router.include_router(ws_depth.router)
router.include_router(ws_user.router)
app.include_router(router)


@app.get("/")
def root():
    return {"message": "Welcome to Testing MM Environment"}

for r in app.router.routes:
    typ = type(r).__name__
    path = getattr(r, "path", getattr(r, "path_regex", str(r)))
    methods = getattr(r, "methods", None)
    print(f"{typ:20}  path={path}  methods={methods}")