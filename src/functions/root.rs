use lambda_http::{
    http::{HeaderName, HeaderValue},
    run,
    tower::ServiceBuilder,
    tracing::{self, Level},
    Body, Error, Request, RequestExt, Response,
};
use sailfish::TemplateOnce;
use tower_http::trace::{DefaultOnRequest, DefaultOnResponse, TraceLayer};

#[derive(TemplateOnce)]
#[template(path = "hello.stpl")]
struct HelloTemplate<'a> {
    messages: Vec<&'a str>, // headers:
    headers: Vec<TemplateHeader<'a>>,
}

struct TemplateHeader<'a> {
    name: &'a str,
    value: &'a str,
}

type Header<'a> = (&'a HeaderName, &'a HeaderValue);

impl<'a> From<Header<'a>> for TemplateHeader<'a> {
    fn from(header_package: Header<'a>) -> TemplateHeader<'a> {
        TemplateHeader {
            name: header_package.0.as_str(),
            value: header_package.1.to_str().unwrap_or("Invalid header value"),
        }
    }
}

async fn handler(event: Request) -> Result<Response<Body>, Error> {
    // Extract some useful information from the request
    let who = event
        .query_string_parameters_ref()
        .and_then(|params| params.first("name"))
        .unwrap_or("jared");
    let place = event
        .query_string_parameters_ref()
        .and_then(|params| params.first("place"))
        .unwrap_or("world");

    let ctx = HelloTemplate {
        messages: vec![who, place],
        headers: event.headers().iter().map(TemplateHeader::from).collect(),
    };

    // Return something that implements IntoResponse.
    // It will be serialized to the right response event automatically by the runtime
    let resp = Response::builder()
        .status(200)
        .header("content-type", "text/html")
        .header("vary", "hx-request")
        .body(ctx.render_once().unwrap().into())
        .map_err(Box::new)?;

    Ok(resp)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing::init_default_subscriber();

    let layer = TraceLayer::new_for_http()
        .on_request(DefaultOnRequest::new().level(Level::INFO))
        .on_response(DefaultOnResponse::new().level(Level::INFO));

    let service = ServiceBuilder::new().layer(layer).service_fn(handler);

    run(service).await
}
