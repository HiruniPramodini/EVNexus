import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, History, RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight, CheckCircle2, ChevronRight, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { getDriverWallet, topUpWallet, getWalletTransactions } from '../../services/api';
import { formatLKR } from '../../utils/currency';

export default function WalletPage({ authUser }) {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal State
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpStep, setTopUpStep] = useState(1); // 1: Amount, 2: Card, 3: Review, 4: Success
  const [topUpAmount, setTopUpAmount] = useState('');
  
  // Card Details (Frontend only simulation)
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardError, setCardError] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const loadWalletData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [walletRes, txRes] = await Promise.all([
        getDriverWallet(authUser?.accessToken),
        getWalletTransactions(1, 20, authUser?.accessToken)
      ]);
      setWallet(walletRes?.data || walletRes || { balance: 0, currency: 'LKR' });
      const rawTxData = txRes?.data ?? txRes;
      setTransactions(Array.isArray(rawTxData) ? rawTxData : []);
    } catch (err) {
      setError(err.message || 'Unable to load wallet data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const openTopUpModal = () => {
    setIsTopUpModalOpen(true);
    setTopUpStep(1);
    setTopUpAmount('');
    setCardName('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCardError(null);
    setSubmitError(null);
  };

  const closeTopUpModal = () => {
    if (isSubmitting) return; // Prevent closing while processing
    setIsTopUpModalOpen(false);
  };

  const handleAmountNext = (e) => {
    e.preventDefault();
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      setCardError('Please enter a valid amount greater than 0.');
      return;
    }
    setCardError(null);
    setTopUpStep(2);
  };

  const handleCardNext = (e) => {
    e.preventDefault();
    setCardError(null);
    if (!cardName.trim()) {
      setCardError('Cardholder name is required.');
      return;
    }
    if (!cardNumber.trim() || cardNumber.replace(/\D/g, '').length < 13) {
      setCardError('Please enter a valid card number.');
      return;
    }
    if (!cardExpiry.trim() || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      setCardError('Please enter expiry in MM/YY format.');
      return;
    }
    if (!cardCvv.trim() || cardCvv.length < 3) {
      setCardError('Please enter a valid CVV.');
      return;
    }
    setTopUpStep(3);
  };

  const handleConfirmPayment = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    
    const amount = parseFloat(topUpAmount);
    const idempotencyKey = `TOPUP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    try {
      // Step 1: Call real backend top-up API with idempotencyKey
      await topUpWallet(amount, idempotencyKey);
      
      // Step 2: Top-up succeeded, refresh from backend for authoritative balance and transaction list
      try {
        const [walletRes, txRes] = await Promise.all([
          getDriverWallet(),
          getWalletTransactions(1, 20)
        ]);
        setWallet(walletRes.data);
        const rawTxData = txRes?.data ?? txRes;
        setTransactions(Array.isArray(rawTxData) ? rawTxData : []);
        setTopUpStep(4); // Success state
      } catch (refreshErr) {
        setSubmitError("Your top-up was submitted successfully, but we couldn't refresh your balance. Please refresh the wallet.");
        setTopUpStep(4);
      }
    } catch (err) {
      setSubmitError(err.message || 'Unable to add funds right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTransactionType = (type) => {
    if (type === 'TOP_UP') return 'Wallet Top-up';
    if (type === 'CHARGING_PAYMENT') return 'Charging Payment';
    if (type === 'REFUND') return 'Refund';
    return type;
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'TOP_UP':
      case 'REFUND':
        return <ArrowDownRight size={18} color="var(--color-success-dark)" />;
      case 'CHARGING_PAYMENT':
        return <ArrowUpRight size={18} color="var(--color-danger-dark)" />;
      default:
        return <CreditCard size={18} />;
    }
  };

  // Safe substring function to prevent crashes on null values
  const safeReferenceFormat = (ref) => {
    if (!ref || typeof ref !== 'string') return 'N/A';
    return ref.substring(0, 8) + '...';
  };

  if (loading && !wallet) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="spinner" />
      </div>
    );
  }

  if (error && !wallet) {
    return (
      <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: 'var(--space-6)' }}>
        <div style={{ display: 'inline-flex', padding: 'var(--space-3)', background: 'var(--color-danger-light)', borderRadius: '50%', marginBottom: 'var(--space-4)' }}>
          <AlertCircle size={36} color="var(--color-danger-dark)" />
        </div>
        <h3 className="text-h3" style={{ marginBottom: 'var(--space-2)', color: 'var(--color-text)' }}>Unable to Load Wallet</h3>
        <p className="text-secondary" style={{ marginBottom: 'var(--space-5)' }}>
          {typeof error === 'string' ? error : 'A server error occurred while retrieving wallet details.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={loadWalletData} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}>
          <RefreshCw size={18} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Wallet Balance Card */}
      <div className="wallet-hero" style={{ marginBottom: 'var(--space-6)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <p className="text-caption" style={{ margin: 0, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Current Balance</p>
            <h1 className="text-h1" style={{ margin: 'var(--space-2) 0', fontSize: '3.5rem', color: '#ffffff', letterSpacing: '-0.03em' }}>
              {formatLKR(wallet?.balance || 0)}
            </h1>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem' }}>
              <span className="status-dot status-dot--pulse" style={{ background: 'var(--brand-300)' }} />
              LKR &bull; Ready for charging
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)' }}>
            <CreditCard size={36} color="var(--brand-300)" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={openTopUpModal} 
            className="btn btn-light" 
            style={{ fontWeight: 700 }}
          >
            <Plus size={18} strokeWidth={2.5} /> Top Up Wallet
          </button>
          <button 
            type="button"
            onClick={loadWalletData} 
            className="btn btn-outline-light"
          >
            <History size={16} /> Refresh Balance
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Transaction History */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <h3 className="text-h3" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={20} color="var(--brand-600)" />
              Recent Transactions
            </h3>
            <button 
              onClick={loadWalletData} 
              className="btn btn-ghost"
              style={{ color: 'var(--text-muted)', padding: '0.4rem' }}
              disabled={loading}
              title="Refresh Transactions"
            >
              <RefreshCw size={18} className={loading ? "spinner" : ""} />
            </button>
          </div>

          {!transactions || transactions.length === 0 ? (
            <div className="empty-state">
              <History size={32} className="empty-state-icon" />
              <h4 className="empty-state-title">No transactions yet.</h4>
              <p className="empty-state-description">Top up your wallet to start charging.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {transactions.map((tx, idx) => {
                const txId = tx.transactionId || tx.id || `tx-${idx}`;
                const rawDate = tx.createdAt || tx.timestamp;
                const dateStr = rawDate ? new Date(rawDate).toLocaleString() : 'N/A';
                const amountVal = typeof tx.amount === 'number' ? tx.amount : (parseFloat(tx.amount) || 0);

                return (
                  <div key={txId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <div style={{ 
                        width: '44px', height: '44px', borderRadius: '50%', 
                        background: tx.type === 'TOP_UP' || tx.type === 'REFUND' ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', fontSize: '1.05rem' }}>
                          {formatTransactionType(tx.type)}
                        </p>
                        <p className="text-caption" style={{ margin: '0.2rem 0 0 0' }}>
                          {dateStr} • Ref: {safeReferenceFormat(tx.referenceId || tx.transactionId)}
                        </p>
                      </div>
                    </div>
                    <div style={{ 
                      fontWeight: 'var(--weight-bold)', fontSize: '1.1rem',
                      color: tx.type === 'TOP_UP' || tx.type === 'REFUND' ? 'var(--color-success-dark)' : 'var(--color-text)' 
                    }}>
                      {tx.type === 'TOP_UP' || tx.type === 'REFUND' ? '+' : '-'}{formatLKR(amountVal)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* MULTI-STEP TOP UP MODAL */}
      {isTopUpModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div 
            className="modal-dialog animate-fade-in" 
            style={{ 
              maxWidth: '450px', 
              maxHeight: '90vh', 
              padding: 0, 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden' 
            }}
          >
            
            {/* Modal Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: 'var(--space-4) var(--space-5)', 
              borderBottom: '1px solid var(--color-border)', 
              background: 'var(--color-surface)',
              flexShrink: 0
            }}>
              <h3 className="text-h3" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={20} color="var(--color-primary)" />
                {topUpStep === 1 && 'Add Money'}
                {topUpStep === 2 && 'Payment Method'}
                {topUpStep === 3 && 'Review Payment'}
                {topUpStep === 4 && 'Payment Successful'}
              </h3>
              {topUpStep !== 4 && !isSubmitting && (
                <button type="button" className="modal-close-btn" onClick={closeTopUpModal}>
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div style={{ 
              padding: 'var(--space-5)', 
              background: 'var(--color-background)', 
              overflowY: 'auto', 
              flex: 1,
              WebkitOverflowScrolling: 'touch'
            }}>
              
              {/* STEP 1: AMOUNT SELECTION */}
              {topUpStep === 1 && (
                <form onSubmit={handleAmountNext}>
                  <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>Choose how much you'd like to add to your wallet.</p>
                  
                  <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    {[500, 1000, 2500, 5000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => { setTopUpAmount(amt.toString()); setCardError(null); }}
                        className="btn btn-outline"
                        style={{
                          padding: 'var(--space-3)',
                          borderColor: topUpAmount === amt.toString() ? 'var(--color-primary)' : 'var(--color-border)',
                          backgroundColor: topUpAmount === amt.toString() ? 'var(--color-primary-light)' : 'transparent',
                          color: topUpAmount === amt.toString() ? 'var(--color-primary-dark)' : 'var(--color-text)'
                        }}
                      >
                        {formatLKR(amt)}
                      </button>
                    ))}
                  </div>

                  <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                    <label className="form-label">Custom Amount (LKR)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>LKR</span>
                      <input
                        type="number"
                        className="form-input"
                        value={topUpAmount}
                        onChange={(e) => { setTopUpAmount(e.target.value); setCardError(null); }}
                        placeholder="0.00"
                        step="1"
                        min="50"
                        style={{ paddingLeft: '3rem' }}
                      />
                    </div>
                  </div>

                  {cardError && (
                    <div className="alert alert-danger" style={{ padding: 'var(--space-2)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
                      <AlertCircle size={14} /> {cardError}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Continue to Payment
                  </button>
                </form>
              )}

              {/* STEP 2: SIMULATED CARD FORM */}
              {topUpStep === 2 && (
                <form onSubmit={handleCardNext}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', color: 'var(--color-primary-dark)' }}>
                    <span style={{ fontWeight: 'var(--weight-semibold)' }}>Amount to add:</span>
                    <span style={{ fontWeight: 'var(--weight-bold)', fontSize: '1.1rem' }}>{formatLKR(parseFloat(topUpAmount) || 0)}</span>
                  </div>

                  <div className="alert alert-info" style={{ marginBottom: 'var(--space-4)', fontSize: '0.85rem' }}>
                    <ShieldCheck size={16} /> Demo payment. No real money will be charged.
                  </div>

                  <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, var(--brand-900) 0%, var(--brand-600) 100%)',
                      borderRadius: '14px',
                      padding: '16px 20px',
                      color: '#ffffff',
                      boxShadow: 'var(--shadow-md)',
                      marginBottom: '16px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <ShieldCheck size={24} />
                        <span style={{ fontStyle: 'italic', fontWeight: 'bold', fontSize: '1.1rem' }}>Visa / Mastercard</span>
                      </div>
                      <div style={{ fontSize: '1.25rem', letterSpacing: '2px', marginBottom: '12px', fontFamily: 'monospace' }}>
                        {cardNumber ? cardNumber.padEnd(16, '•').replace(/(.{4})/g, '$1 ') : '•••• •••• •••• ••••'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.8 }}>Cardholder Name</div>
                          <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 600 }}>{cardName || 'JANE DOE'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.8 }}>Valid Thru</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{cardExpiry || 'MM/YY'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                    <label className="form-label">Cardholder Name</label>
                    <input type="text" className="form-input" value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Jane Doe" />
                  </div>

                  <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                    <label className="form-label">Card Number</label>
                    <input type="text" className="form-input" value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" maxLength="19" />
                  </div>

                  <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                    <div className="form-group">
                      <label className="form-label">Expiry Date</label>
                      <input type="text" className="form-input" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} placeholder="MM/YY" maxLength="5" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">CVV</label>
                      <input type="password" className="form-input" value={cardCvv} onChange={e => setCardCvv(e.target.value)} placeholder="123" maxLength="4" />
                    </div>
                  </div>

                  {cardError && (
                    <div className="alert alert-danger" style={{ padding: 'var(--space-2)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
                      <AlertCircle size={14} /> {cardError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setTopUpStep(1)} style={{ flex: 1 }}>Back</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Review Payment</button>
                  </div>
                </form>
              )}

              {/* STEP 3: REVIEW PAYMENT */}
              {topUpStep === 3 && (
                <div>
                  <div className="card" style={{ padding: 'var(--space-4)', background: '#fff', marginBottom: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                      <span className="text-secondary">Wallet Top-Up</span>
                      <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatLKR(parseFloat(topUpAmount) || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                      <span className="text-secondary">Payment Method</span>
                      <span style={{ fontWeight: 'var(--weight-semibold)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CreditCard size={16} />
                        Visa/Mastercard •••• {cardNumber.replace(/\D/g, '').slice(-4) || '4242'}
                      </span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px dashed var(--color-border)', margin: 'var(--space-3) 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>Total Amount</span>
                      <span className="text-h3" style={{ color: 'var(--color-primary-dark)' }}>{formatLKR(parseFloat(topUpAmount) || 0)}</span>
                    </div>
                  </div>

                  <div className="alert alert-info" style={{ marginBottom: 'var(--space-5)', fontSize: '0.85rem' }}>
                    <ShieldCheck size={16} /> Demo payment. No real money will be charged.
                  </div>

                  {submitError && (
                    <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>
                      <AlertTriangle size={18} /> {submitError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setTopUpStep(2)} disabled={isSubmitting} style={{ flex: 1 }}>
                      Back
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleConfirmPayment} disabled={isSubmitting} style={{ flex: 2 }}>
                      {isSubmitting ? <><RefreshCw size={18} className="spinner" /> Processing...</> : 'Confirm Payment'}
                    </button>
                  </div>
                  {isSubmitting && (
                    <p className="text-caption" style={{ textAlign: 'center', marginTop: 'var(--space-3)', color: 'var(--color-primary)' }}>
                      Adding funds to your wallet...
                    </p>
                  )}
                </div>
              )}

              {/* STEP 4: SUCCESS */}
              {topUpStep === 4 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                  <div style={{ display: 'inline-flex', padding: 'var(--space-4)', background: 'var(--color-success-light)', borderRadius: '50%', marginBottom: 'var(--space-4)' }}>
                    <CheckCircle2 size={48} color="var(--color-success-dark)" />
                  </div>
                  <h3 className="text-h2" style={{ color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>Payment Successful</h3>
                  <p className="text-secondary" style={{ marginBottom: 'var(--space-5)' }}>
                    <strong>{formatLKR(parseFloat(topUpAmount) || 0)}</strong> has been added to your wallet.
                  </p>

                  {submitError && (
                    <div className="alert alert-warning" style={{ marginBottom: 'var(--space-5)', textAlign: 'left', fontSize: '0.85rem' }}>
                      <AlertTriangle size={16} /> {submitError}
                    </div>
                  )}

                  <div className="card" style={{ padding: 'var(--space-4)', background: '#fff', marginBottom: 'var(--space-5)' }}>
                    <p className="text-caption" style={{ margin: '0 0 var(--space-1) 0', textTransform: 'uppercase' }}>New Wallet Balance</p>
                    <h2 className="text-h2" style={{ margin: 0, color: 'var(--color-primary-dark)' }}>
                      {formatLKR(wallet?.balance || 0)}
                    </h2>
                  </div>

                  <button type="button" className="btn btn-primary" onClick={closeTopUpModal} style={{ width: '100%' }}>
                    Done
                  </button>
                </div>
              )}
              
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
