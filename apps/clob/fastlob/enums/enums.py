'''All the project enumerations are grouped here for simplicity.'''

from enum import Enum

class OrderSide(Enum):
    '''The side of an order/limit, can be BID or ASK.'''

    BID = False
    '''The bid (buy) side.'''
    ASK = True
    '''The ask (sell) side.'''

    @staticmethod
    def invert(side):
        '''Invert the side and return it.'''
        return OrderSide.BID if side == OrderSide.ASK else OrderSide.ASK

class OrderType(Enum):
    '''The type of the order, can be FOK, GTC or GTD.'''

    FOK = "FOK"
    '''A fill or kill (FOK) order is a conditional order requiring the transaction to be executed immediately and to 
    its full amount at a stated price. If any of the conditions are broken, then the order must be automatically 
    canceled (kill) right away.'''
    GTC = "GTC"
    '''A Good-Til-Cancelled (GTC) order is an order to buy or sell a stock that lasts until the order is completed 
    or canceled.
    '''
    GTD = "GTD"
    '''A Good-Til-Day (GTD) order is a type of order that is active until its specified date (UTC seconds timestamp), 
    unless it has already been fulfilled or cancelled.
    '''
    FAKE = "FAKE"
    '''Used when running lob with historical data.'''

class OrderStatus(Enum):
    '''The status of an order.'''

    CREATED = "CREATED"
    '''Order created but not in a limit queue or executed yet.'''
    PENDING = "PENDING"
    '''Order in line in limit to be filled but not modified in any ways yet.'''
    FILLED = "FILLED"
    '''Order entirely filled, not in limit.'''
    PARTIAL = "PARTIAL_FILLED"
    '''Order partially filled.'''
    CANCELED = "CANCELED"
    '''Order canceled, can not be fully or partially filled anymore.'''
    ERROR = "ERROR"
    '''Set by the lob if the order can not be processed.'''

    @staticmethod
    def valid_states() -> set:
        '''Returns the set of states in which an order is considered valid.'''
        return {OrderStatus.CREATED, OrderStatus.PENDING, OrderStatus.PARTIAL}

class ResultType(Enum):
    '''The type of execution result.'''

    ERROR = "ERROR"
    '''If the query could not be processed by the lob.'''
    LIMIT = "LIMIT"
    '''If the order was placed in a limit.'''
    MARKET = "MARKET"
    '''If the order was executed as market.'''
    PARTIAL_MARKET = "PARTIAL_MARKET"
    '''If the order was partially executed as market, and then placed in limit.'''
    UPDATE = "UPDATE"
    '''If the operation was an order update.'''
    CANCEL = "CANCEL"
    '''If the operation was an order cancellation.'''

    def in_limit(self) -> bool:
        '''True if the operation results in the order sitting in the limit.'''
        return self in {ResultType.LIMIT, ResultType.PARTIAL_MARKET, ResultType.UPDATE}
