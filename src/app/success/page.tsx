import Link from 'next/link';

type SuccessPageProps = {
  searchParams?: { session_id?: string | string[] };
};

export default function SuccessPage({ searchParams }: SuccessPageProps) {
  const sessionId =
    typeof searchParams?.session_id === 'string' ? searchParams.session_id : undefined;

  return (
    <section className="section success-page">
      <div className="card">
        <h1>Thanks for your order!</h1>
        <p className="success-message">
          {`Your payment has been received!

We'll start prepping your Dark Contraster fulfillment and send shipping details to your email soon.`}
        </p>
        {sessionId && (
          <p className="muted">
            Reference ID:
            {' '}
            <code>{sessionId}</code>
          </p>
        )}
        <Link className="buy-button" href="/#gallery">
          Back to Gallery
        </Link>
      </div>
    </section>
  );
}
