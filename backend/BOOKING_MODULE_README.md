# Booking System Module - Documentation

## Overview

The Booking System is a comprehensive module for managing property/unit reservations before purchase. It provides a complete workflow for holding units temporarily for clients, tracking purchase intent lifecycle, and converting bookings to sales.

## Features

### 1. **Booking Management**
- Create bookings for properties or units
- Track booking status lifecycle
- Auto-expire bookings after holding period
- Convert bookings to sales/deals
- Assign bookings to dealers/agents/staff

### 2. **Status Lifecycle**
- **PENDING**: Initial booking state
- **RESERVED**: Unit is reserved for client
- **CONFIRMED**: Booking confirmed by client
- **CANCELLED**: Booking cancelled
- **EXPIRED**: Booking expired after holding period
- **CONVERTED_TO_SALE**: Booking converted to a deal

### 3. **Business Rules**
- A unit cannot be double-booked (unless previous booking is expired/cancelled)
- Bookings auto-expire after holding period
- When booking is confirmed, unit status can be locked
- Price snapshot is captured at booking time
- Complete audit trail of all booking actions

### 4. **Assignment System**
- Assign bookings to dealers
- Assign bookings to staff/agents
- Track nominee information (if different from client)

### 5. **Expiry Management**
- Configurable holding period (default 7 days)
- Auto-expiry cron job (runs every hour)
- Extend booking expiry date
- Alert for bookings expiring soon (within 24 hours)

## Database Schema

### Bookings Table
```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    booking_id VARCHAR(20) UNIQUE NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    property_id INTEGER REFERENCES properties(id),
    unit_id INTEGER REFERENCES units(id),
    project_id INTEGER,
    assigned_dealer_id INTEGER REFERENCES dealers(id),
    assigned_staff_id INTEGER REFERENCES users(id),
    nominee_name VARCHAR(120),
    nominee_phone VARCHAR(50),
    nominee_cnic VARCHAR(20),
    booking_amount NUMERIC(12,2) NOT NULL,
    property_price NUMERIC(12,2) NOT NULL,
    booking_date TIMESTAMP NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    holding_days INTEGER NOT NULL DEFAULT 7,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    confirmed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    expired_at TIMESTAMP,
    converted_at TIMESTAMP
);
```

### Booking Logs Table (Audit Trail)
```sql
CREATE TABLE booking_logs (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    action VARCHAR(50) NOT NULL,
    old_value VARCHAR(255),
    new_value VARCHAR(255),
    performed_by_id INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL
);
```

### Booking Attachments Table
```sql
CREATE TABLE booking_attachments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    file_path VARCHAR(512) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    created_at TIMESTAMP NOT NULL
);
```

## API Endpoints

### Booking CRUD

#### List Bookings
```http
GET /crm/bookings/bookings
Query Parameters:
  - status: Filter by status
  - client_id: Filter by client
  - property_id: Filter by property
  - unit_id: Filter by unit
  - dealer_id: Filter by dealer
  - expiring_soon: Show only expiring in 24h (boolean)
```

#### Create Booking
```http
POST /crm/bookings/bookings
Body:
{
  "client_id": 1,
  "property_id": 5,
  "unit_id": 12,
  "booking_amount": 5000.00,
  "property_price": 250000.00,
  "holding_days": 7,
  "assigned_dealer_id": 3,
  "notes": "VIP client"
}
```

#### Get Booking Details
```http
GET /crm/bookings/bookings/{booking_id}
```

#### Update Booking
```http
PATCH /crm/bookings/bookings/{booking_id}
Body:
{
  "assigned_dealer_id": 5,
  "notes": "Updated notes"
}
```

#### Delete Booking
```http
DELETE /crm/bookings/bookings/{booking_id}
```

### Status Management

#### Update Booking Status
```http
PATCH /crm/bookings/bookings/{booking_id}/status
Body:
{
  "status": "confirmed",
  "notes": "Client confirmed via phone"
}
```

#### Extend Booking
```http
POST /crm/bookings/bookings/{booking_id}/extend
Body:
{
  "additional_days": 7,
  "notes": "Client requested extension"
}
```

#### Assign Booking
```http
POST /crm/bookings/bookings/{booking_id}/assign
Body:
{
  "assigned_dealer_id": 3,
  "assigned_staff_id": 5,
  "notes": "Assigned to senior agent"
}
```

#### Convert to Sale
```http
POST /crm/bookings/bookings/{booking_id}/convert-to-sale
Body:
{
  "deal_title": "Unit 12A Purchase",
  "deal_value": 250000.00,
  "down_payment": 50000.00,
  "notes": "Converted to full sale"
}
```

### Attachments

#### Upload Attachment
```http
POST /crm/bookings/bookings/{booking_id}/attachments
Form Data:
  - file: File
  - file_type: agreement|receipt|id_proof|other
```

#### Delete Attachment
```http
DELETE /crm/bookings/bookings/{booking_id}/attachments/{attachment_id}
```

### Statistics & Reports

#### Get Booking Stats
```http
GET /crm/bookings/bookings/stats/summary
Response:
{
  "total_bookings": 150,
  "pending_bookings": 25,
  "reserved_bookings": 30,
  "confirmed_bookings": 40,
  "cancelled_bookings": 20,
  "expired_bookings": 15,
  "converted_bookings": 20,
  "expiring_soon": 5,
  "total_booking_amount": 750000.00,
  "total_property_value": 37500000.00
}
```

#### Get Expiring Soon
```http
GET /crm/bookings/bookings/expiring-soon/list?hours=24
```

#### Auto-Expire Old Bookings (Cron)
```http
POST /crm/bookings/bookings/expire-old/cron
```

### Availability Check

#### Check Unit/Property Availability
```http
GET /crm/bookings/bookings/check-availability?unit_id=12
Response:
{
  "available": true,
  "unit_id": 12,
  "property_id": null
}
```

## Service Layer

### BookingService Methods

#### `check_unit_availability(db, unit_id, property_id, exclude_booking_id)`
Check if a unit/property is available for booking.

#### `calculate_expiry_date(booking_date, holding_days)`
Calculate expiry date based on booking date and holding period.

#### `is_booking_expired(booking)`
Check if booking has expired.

#### `get_days_remaining(booking)`
Get days remaining until expiry.

#### `create_log(db, booking_id, action, old_value, new_value, performed_by_id, notes)`
Create a booking log entry for audit trail.

#### `update_booking_status(db, booking, new_status, performed_by_id, notes, cancellation_reason)`
Update booking status with validation and logging.

#### `extend_booking(db, booking, additional_days, performed_by_id, notes)`
Extend booking expiry date.

#### `assign_booking(db, booking, dealer_id, staff_id, performed_by_id, notes)`
Assign booking to dealer or staff.

#### `convert_to_sale(db, booking, deal_title, deal_value, down_payment, performed_by_id, notes)`
Convert booking to a deal/sale.

#### `expire_old_bookings(db)`
Cron job to auto-expire bookings past their expiry date.

#### `get_expiring_soon(db, hours)`
Get bookings expiring within specified hours.

#### `get_booking_stats(db)`
Get booking statistics for dashboard.

## Scheduler

### Auto-Expiry Cron Job

The booking module includes an automatic expiry scheduler that runs every hour to expire bookings past their expiry date.

**Configuration:**
- Runs every 1 hour
- Automatically expires bookings with status `pending` or `reserved` that are past their expiry date
- Logs all expired bookings

**Manual Trigger:**
You can also manually trigger the expiry job via API:
```http
POST /crm/bookings/bookings/expire-old/cron
```

## Frontend Integration

### React Component: `Bookings.tsx`

The frontend provides a comprehensive booking management interface with:

1. **Dashboard Stats Cards**
   - Total bookings
   - Active bookings
   - Expiring soon
   - Converted to sale

2. **Booking List Table**
   - Filterable by status
   - Sortable columns
   - Color-coded status chips
   - Days remaining indicator
   - Quick actions (view, confirm, cancel)

3. **Tabs**
   - All Bookings
   - Pending
   - Reserved
   - Confirmed
   - Expiring Soon

4. **Actions**
   - Create new booking
   - View booking details
   - Update status
   - Extend expiry
   - Assign to dealer/staff
   - Convert to sale
   - Upload attachments

### Navigation

The Bookings module is accessible from:
- CRM page → Bookings tab
- Direct URL: `/crm/bookings`

## Permissions

The booking module uses the following permissions:
- `crm:view` or `booking:view` - View bookings
- `crm:manage` or `booking:manage` - Create/update/delete bookings

## Migration

Run the migration to create the booking tables:

```bash
cd backend
alembic upgrade head
```

This will execute migration `0022_booking_module.py` which creates:
- `bookings` table
- `booking_logs` table
- `booking_attachments` table
- All necessary indexes and foreign keys

## Usage Examples

### Example 1: Create a Booking

```python
from app.services.booking_service import BookingService
from datetime import datetime

# Create booking
booking = Booking(
    booking_id="BKG-0001",
    client_id=1,
    unit_id=12,
    booking_amount=5000.00,
    property_price=250000.00,
    booking_date=datetime.utcnow(),
    expiry_date=BookingService.calculate_expiry_date(datetime.utcnow(), 7),
    holding_days=7,
    status="pending"
)
db.add(booking)
db.commit()
```

### Example 2: Check Availability

```python
available = BookingService.check_unit_availability(
    db=db,
    unit_id=12
)
if not available:
    raise HTTPException(400, "Unit already booked")
```

### Example 3: Convert to Sale

```python
deal = BookingService.convert_to_sale(
    db=db,
    booking=booking,
    deal_title="Unit 12A Purchase",
    deal_value=250000.00,
    down_payment=50000.00,
    performed_by_id=current_user.id
)
```

## Best Practices

1. **Always check availability** before creating a booking
2. **Capture price snapshot** at booking time to track price changes
3. **Use audit logs** to track all booking actions
4. **Set appropriate holding periods** based on your business needs
5. **Monitor expiring bookings** regularly to follow up with clients
6. **Convert to sale** as soon as client confirms to lock the unit
7. **Use assignments** to track responsibility and accountability

## Troubleshooting

### Issue: Bookings not auto-expiring
**Solution:** Check that the scheduler is running. Verify in logs:
```
[Booking Scheduler] Registered booking expiry job (runs every hour)
```

### Issue: Double booking error
**Solution:** Ensure previous booking is expired or cancelled before creating new one.

### Issue: Cannot convert booking to sale
**Solution:** Check booking status. Only `pending`, `reserved`, or `confirmed` bookings can be converted.

## Future Enhancements

Potential future features:
1. Email/SMS notifications for expiring bookings
2. Payment integration for booking amounts
3. Booking templates for common scenarios
4. Bulk booking operations
5. Advanced reporting and analytics
6. Integration with calendar systems
7. Booking approval workflow
8. Multi-currency support

## Support

For issues or questions, please contact the development team or refer to the main REMS documentation.
